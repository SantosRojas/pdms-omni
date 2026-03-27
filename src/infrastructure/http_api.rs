//! HTTP REST API: Auth, Users, Equivalences, Telemetry history using sqlx.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use axum::extract::{Path, Query, State};
use axum::http::{StatusCode, HeaderMap};
use axum::response::IntoResponse;
use axum::Json;
use sqlx::{SqlitePool, Row};
use serde::{Deserialize, Serialize};

use crate::domain::entities::TelemetryValue;

// ─── Shared State ───────────────────────────────────────────────

#[derive(Clone, Debug, Serialize)]
pub struct Session {
    pub user_id: i64,
    pub username: String,
    pub full_name: String,
    pub email: String,
    pub role: String,
}

#[derive(Clone)]
pub struct ApiState {
    pub db: SqlitePool,
    pub sessions: Arc<Mutex<HashMap<String, Session>>>,
}

fn generate_token() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("{:x}-{:x}", nanos, nanos.wrapping_mul(2654435761))
}

/// Extracts the session from the Authorization: Bearer <token> header.
fn get_session(headers: &HeaderMap, state: &ApiState) -> Option<Session> {
    let auth = headers.get("authorization")?.to_str().ok()?;
    let token = auth.strip_prefix("Bearer ")?;
    let sessions = state.sessions.lock().ok()?;
    sessions.get(token).cloned()
}

fn unauthorized() -> impl IntoResponse {
    (StatusCode::UNAUTHORIZED, Json(serde_json::json!({"error": "Unauthorized"}))).into_response()
}

fn forbidden() -> impl IntoResponse {
    (StatusCode::FORBIDDEN, Json(serde_json::json!({"error": "Forbidden: insufficient role"}))).into_response()
}

fn db_err(msg: String) -> impl IntoResponse {
    (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": msg}))).into_response()
}

// ═══════════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════════

#[derive(Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: UserDto,
}

#[derive(Serialize, Clone)]
pub struct UserDto {
    pub id: i64,
    pub username: String,
    pub full_name: String,
    pub email: String,
    pub role: String,
    pub active: bool,
    pub created_at: String,
}

/// POST /api/auth/login
pub async fn login(
    State(state): State<ApiState>,
    Json(body): Json<LoginRequest>,
) -> impl IntoResponse {
    let result = sqlx::query(
        "SELECT id, username, password, full_name, email, role, active, created_at FROM users WHERE username = ?1"
    )
    .bind(&body.username)
    .fetch_optional(&state.db)
    .await;

    match result {
        Ok(Some(row)) => {
            let id: i64 = row.get(0);
            let username: String = row.get(1);
            let password_hash: String = row.get(2);
            let full_name: String = row.get(3);
            let email: String = row.get(4);
            let role: String = row.get(5);
            let active: bool = row.get(6);
            let created_at: String = row.get(7);

            if !active {
                return (StatusCode::FORBIDDEN, Json(serde_json::json!({"error": "Account disabled"}))).into_response();
            }
            if password_hash != body.password {
                return (StatusCode::UNAUTHORIZED, Json(serde_json::json!({"error": "Invalid credentials"}))).into_response();
            }

            let token = generate_token();
            let user = UserDto { id, username: username.clone(), full_name: full_name.clone(), email: email.clone(), role: role.clone(), active, created_at };
            let session = Session { user_id: id, username, full_name, email, role };

            if let Ok(mut sessions) = state.sessions.lock() {
                sessions.insert(token.clone(), session);
            }

            Json(LoginResponse { token, user }).into_response()
        }
        Ok(None) => (StatusCode::UNAUTHORIZED, Json(serde_json::json!({"error": "Invalid credentials"}))).into_response(),
        Err(e) => db_err(e.to_string()).into_response(),
    }
}

/// POST /api/auth/logout
pub async fn logout(
    State(state): State<ApiState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if let Some(auth) = headers.get("authorization").and_then(|v| v.to_str().ok()) {
        if let Some(token) = auth.strip_prefix("Bearer ") {
            if let Ok(mut sessions) = state.sessions.lock() {
                sessions.remove(token);
            }
        }
    }
    Json(serde_json::json!({"ok": true})).into_response()
}

/// GET /api/auth/me
pub async fn get_me(
    State(state): State<ApiState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    match get_session(&headers, &state) {
        Some(session) => Json(serde_json::json!({
            "user_id": session.user_id,
            "username": session.username,
            "full_name": session.full_name,
            "email": session.email,
            "role": session.role,
        })).into_response(),
        None => unauthorized().into_response(),
    }
}

// ═══════════════════════════════════════════════════════════════
//  USERS CRUD (admin only)
// ═══════════════════════════════════════════════════════════════

/// GET /api/users
pub async fn list_users(
    State(state): State<ApiState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let session = match get_session(&headers, &state) {
        Some(s) => s,
        None => return unauthorized().into_response(),
    };
    if session.role != "admin" {
        return forbidden().into_response();
    }

    let result = sqlx::query("SELECT id, username, full_name, email, role, active, created_at FROM users ORDER BY id")
        .fetch_all(&state.db)
        .await;

    match result {
        Ok(rows) => {
            let users: Vec<UserDto> = rows.into_iter().map(|row| UserDto {
                id: row.get(0),
                username: row.get(1),
                full_name: row.get(2),
                email: row.get(3),
                role: row.get(4),
                active: row.get(5),
                created_at: row.get(6),
            }).collect();
            Json(users).into_response()
        }
        Err(e) => db_err(e.to_string()).into_response(),
    }
}

#[derive(Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
    pub password: String,
    pub full_name: Option<String>,
    pub email: Option<String>,
    pub role: String,
}

/// POST /api/users
pub async fn create_user(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Json(body): Json<CreateUserRequest>,
) -> impl IntoResponse {
    let session = match get_session(&headers, &state) {
        Some(s) => s,
        None => return unauthorized().into_response(),
    };
    if session.role != "admin" {
        return forbidden().into_response();
    }

    if !["admin", "operator", "viewer"].contains(&body.role.as_str()) {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Invalid role. Must be: admin, operator, viewer"}))).into_response();
    }

    let full_name = body.full_name.unwrap_or_default();
    let email = body.email.unwrap_or_default();

    match sqlx::query(
        "INSERT INTO users (username, password, full_name, email, role) VALUES (?1, ?2, ?3, ?4, ?5)"
    )
    .bind(&body.username)
    .bind(&body.password)
    .bind(&full_name)
    .bind(&email)
    .bind(&body.role)
    .execute(&state.db).await {
        Ok(_) => Json(serde_json::json!({"ok": true})).into_response(),
        Err(e) => (StatusCode::CONFLICT, Json(serde_json::json!({"error": e.to_string()}))).into_response(),
    }
}

#[derive(Deserialize)]
pub struct UpdateUserRequest {
    pub password: Option<String>,
    pub full_name: Option<String>,
    pub email: Option<String>,
    pub role: Option<String>,
    pub active: Option<bool>,
}

/// PUT /api/users/:id
pub async fn update_user(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(user_id): Path<i64>,
    Json(body): Json<UpdateUserRequest>,
) -> impl IntoResponse {
    let session = match get_session(&headers, &state) {
        Some(s) => s,
        None => return unauthorized().into_response(),
    };

    let is_admin = session.role == "admin";
    let is_self = session.user_id == user_id;

    if !is_admin && !is_self {
        return forbidden().into_response();
    }

    if let Some(ref role) = body.role {
        if !is_admin {
            return forbidden().into_response();
        }
        if !["admin", "operator", "viewer"].contains(&role.as_str()) {
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Invalid role"}))).into_response();
        }
    }

    if body.active.is_some() && !is_admin {
        return forbidden().into_response(); 
    }

    if let Some(ref pw) = body.password {
        let _ = sqlx::query("UPDATE users SET password = ?1 WHERE id = ?2").bind(pw).bind(user_id).execute(&state.db).await;
    }
    if let Some(ref fn_) = body.full_name {
        let _ = sqlx::query("UPDATE users SET full_name = ?1 WHERE id = ?2").bind(fn_).bind(user_id).execute(&state.db).await;
    }
    if let Some(ref e) = body.email {
        let _ = sqlx::query("UPDATE users SET email = ?1 WHERE id = ?2").bind(e).bind(user_id).execute(&state.db).await;
    }
    if let Some(ref role) = body.role {
        let _ = sqlx::query("UPDATE users SET role = ?1 WHERE id = ?2").bind(role).bind(user_id).execute(&state.db).await;
    }
    if let Some(active) = body.active {
        let _ = sqlx::query("UPDATE users SET active = ?1 WHERE id = ?2").bind(active).bind(user_id).execute(&state.db).await;
    }

    Json(serde_json::json!({"ok": true})).into_response()
}

/// DELETE /api/users/:id
pub async fn delete_user(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(user_id): Path<i64>,
) -> impl IntoResponse {
    let session = match get_session(&headers, &state) {
        Some(s) => s,
        None => return unauthorized().into_response(),
    };
    if session.role != "admin" {
        return forbidden().into_response();
    }
    // Prevent self-deletion
    if session.user_id == user_id {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Cannot delete yourself"}))).into_response();
    }

    let _ = sqlx::query("DELETE FROM users WHERE id = ?1").bind(user_id).execute(&state.db).await;
    Json(serde_json::json!({"ok": true})).into_response()
}

// ═══════════════════════════════════════════════════════════════
//  EQUIVALENCES CRUD
// ═══════════════════════════════════════════════════════════════

#[derive(Serialize)]
pub struct EquivalenceDto {
    pub signal_id: i64,
    pub internal_name: String,
    pub numeric_value: f64,
    pub display_name: String,
}

/// GET /api/equivalences
pub async fn list_equivalences(
    State(state): State<ApiState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if get_session(&headers, &state).is_none() {
        return unauthorized().into_response();
    }

    let result = sqlx::query(
        "SELECT ae.signal_id, s.internal_name, ae.numeric_value, ae.display_name
         FROM attribute_equivalences ae
         JOIN signals s ON ae.signal_id = s.id
         ORDER BY s.internal_name, ae.numeric_value"
    )
    .fetch_all(&state.db).await;

    match result {
        Ok(rows) => {
            let eq: Vec<EquivalenceDto> = rows.into_iter().map(|row| EquivalenceDto {
                signal_id: row.get(0),
                internal_name: row.get(1),
                numeric_value: row.get(2),
                display_name: row.get(3),
            }).collect();
            Json(eq).into_response()
        }
        Err(e) => db_err(e.to_string()).into_response(),
    }
}

#[derive(Deserialize)]
pub struct CreateEquivalenceRequest {
    pub internal_name: String,
    pub numeric_value: f64,
    pub display_name: String,
}

/// POST /api/equivalences
pub async fn create_equivalence(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Json(body): Json<CreateEquivalenceRequest>,
) -> impl IntoResponse {
    let session = match get_session(&headers, &state) {
        Some(s) => s,
        None => return unauthorized().into_response(),
    };
    if session.role == "viewer" {
        return forbidden().into_response();
    }

    let _ = sqlx::query("INSERT OR IGNORE INTO signals (internal_name) VALUES (?1)")
        .bind(&body.internal_name).execute(&state.db).await;

    let res = sqlx::query("SELECT id FROM signals WHERE internal_name = ?1")
        .bind(&body.internal_name).fetch_one(&state.db).await;

    match res {
        Ok(row) => {
            let sid: i64 = row.get(0);
            match sqlx::query("INSERT OR REPLACE INTO attribute_equivalences (signal_id, numeric_value, display_name) VALUES (?1, ?2, ?3)")
                .bind(sid).bind(body.numeric_value).bind(&body.display_name).execute(&state.db).await {
                Ok(_) => Json(serde_json::json!({"ok": true, "signal_id": sid})).into_response(),
                Err(e) => db_err(e.to_string()).into_response(),
            }
        }
        Err(e) => db_err(e.to_string()).into_response(),
    }
}

#[derive(Deserialize)]
pub struct DeleteEquivalenceQuery {
    pub signal_id: i64,
    pub numeric_value: f64,
}

/// DELETE /api/equivalences
pub async fn delete_equivalence(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Query(params): Query<DeleteEquivalenceQuery>,
) -> impl IntoResponse {
    let session = match get_session(&headers, &state) {
        Some(s) => s,
        None => return unauthorized().into_response(),
    };
    if session.role != "admin" {
        return forbidden().into_response();
    }

    let _ = sqlx::query("DELETE FROM attribute_equivalences WHERE signal_id = ?1 AND numeric_value = ?2")
        .bind(params.signal_id).bind(params.numeric_value).execute(&state.db).await;

    Json(serde_json::json!({"ok": true})).into_response()
}

// ═══════════════════════════════════════════════════════════════
//  TELEMETRY (patients + history + export)
// ═══════════════════════════════════════════════════════════════

#[derive(Serialize)]
pub struct PatientDto {
    pub id: i64,
    pub patient_id_str: String,
    pub created_at: String,
}

#[derive(Serialize)]
pub struct HistoryRowDto {
    pub id: i64,
    pub timestamp: String,
    pub internal_name: String,
    pub physical_value: TelemetryValue,
    pub display_value: Option<String>,
    pub unit: String,
}

#[derive(Deserialize)]
pub struct HistoryQuery {
    pub patient: String,
    #[serde(default = "default_limit")]
    pub limit: u32,
}
fn default_limit() -> u32 { 500 }

#[derive(Deserialize)]
pub struct ExportQuery {
    pub patient: String,
    #[serde(default = "default_export_limit")]
    pub limit: u32,
}
fn default_export_limit() -> u32 { 5000 }

/// GET /api/patients
pub async fn list_patients(State(state): State<ApiState>) -> impl IntoResponse {
    let result = sqlx::query("SELECT id, patient_id_str, created_at FROM patients ORDER BY created_at DESC")
        .fetch_all(&state.db).await;

    match result {
        Ok(rows) => {
            let pts: Vec<PatientDto> = rows.into_iter().map(|row| PatientDto {
                id: row.get(0), patient_id_str: row.get(1), created_at: row.get(2)
            }).collect();
            Json(pts).into_response()
        }
        Err(e) => db_err(e.to_string()).into_response(),
    }
}

/// GET /api/history?patient=XYZ&limit=500
pub async fn patient_history(
    State(state): State<ApiState>,
    Query(params): Query<HistoryQuery>,
) -> impl IntoResponse {
    let result = sqlx::query(
        "SELECT t.id, t.timestamp, s.internal_name, CAST(t.physical_value AS TEXT), e.display_name, t.unit
         FROM telemetry t
         JOIN patients p ON t.patient_id = p.id
         JOIN signals s ON t.signal_id = s.id
         LEFT JOIN attribute_equivalences e ON s.id = e.signal_id AND t.physical_value = e.numeric_value
         WHERE p.patient_id_str = ?1
         ORDER BY t.timestamp DESC LIMIT ?2"
    )
    .bind(&params.patient)
    .bind(params.limit)
    .fetch_all(&state.db).await;

    match result {
        Ok(rows) => {
            let data: Vec<HistoryRowDto> = rows.into_iter().map(|row| {
                let phys_str: String = row.get(3);
                let physical_value = if let Ok(n) = phys_str.parse::<f64>() {
                    TelemetryValue::Number(n)
                } else {
                    TelemetryValue::String(phys_str)
                };
                HistoryRowDto {
                    id: row.get(0),
                    timestamp: row.get(1),
                    internal_name: row.get(2),
                    physical_value,
                    display_value: row.get(4),
                    unit: row.get(5),
                }
            }).collect();
            Json(data).into_response()
        }
        Err(e) => db_err(e.to_string()).into_response(),
    }
}

/// GET /api/export?patient=XYZ&limit=5000
pub async fn export_csv(
    State(state): State<ApiState>,
    Query(params): Query<ExportQuery>,
) -> impl IntoResponse {
    let result = sqlx::query(
        "SELECT t.timestamp, s.internal_name, CAST(t.physical_value AS TEXT), e.display_name, t.unit
         FROM telemetry t
         JOIN patients p ON t.patient_id = p.id
         JOIN signals s ON t.signal_id = s.id
         LEFT JOIN attribute_equivalences e ON s.id = e.signal_id AND t.physical_value = e.numeric_value
         WHERE p.patient_id_str = ?1
         ORDER BY t.timestamp ASC LIMIT ?2"
    )
    .bind(&params.patient)
    .bind(params.limit)
    .fetch_all(&state.db).await;

    match result {
        Ok(rows) => {
            let mut csv = String::from("\u{FEFF}Timestamp,Parameter,Value,Display,Unit\n");
            for row in rows {
                let ts: String = row.get(0);
                let name: String = row.get(1);
                let val_str: String = row.get(2);
                let disp: String = row.get::<Option<String>, _>(3).unwrap_or_default();
                let unit: String = row.get(4);
                
                csv.push_str(&format!("{},{},{},{},{}\n",
                    ts.replace(',', ";"), name.replace(',', ";"), val_str, disp.replace(',', ";"), unit.replace(',', ";")
                ));
            }

            let filename = format!("omni_report_{}.csv", params.patient);
            (
                StatusCode::OK,
                [
                    ("Content-Type", "text/csv; charset=utf-8"),
                    ("Content-Disposition", &format!("attachment; filename=\"{}\"", filename)),
                ],
                csv,
            ).into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

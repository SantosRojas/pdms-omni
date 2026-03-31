//! HTTP REST API: Auth, Users, Equivalences, Telemetry history.
//! Uses DbPool abstraction to support both SQLite and SQL Server.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use axum::extract::{Path, Query, State};
use axum::http::{StatusCode, HeaderMap};
use axum::response::IntoResponse;
use axum::Json;
use serde::{Deserialize, Serialize};

use crate::domain::entities::TelemetryValue;
use crate::infrastructure::db_pool::DbPool;

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
    pub db: DbPool,
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
    match state.db.find_user_by_username(&body.username).await {
        Ok(Some(row)) => {
            let id = row.get_i64(0);
            let username = row.get_string(1);
            let password_hash = row.get_string(2);
            let full_name = row.get_string(3);
            let email = row.get_string(4);
            let role = row.get_string(5);
            let active = row.get_bool(6);
            let created_at = row.get_string(7);

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
        Err(e) => db_err(e).into_response(),
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

    match state.db.list_users().await {
        Ok(rows) => {
            let users: Vec<UserDto> = rows.into_iter().map(|row| UserDto {
                id: row.get_i64(0),
                username: row.get_string(1),
                full_name: row.get_string(2),
                email: row.get_string(3),
                role: row.get_string(4),
                active: row.get_bool(5),
                created_at: row.get_string(6),
            }).collect();
            Json(users).into_response()
        }
        Err(e) => db_err(e).into_response(),
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

    match state.db.insert_user(&body.username, &body.password, &full_name, &email, &body.role).await {
        Ok(_) => Json(serde_json::json!({"ok": true})).into_response(),
        Err(e) => (StatusCode::CONFLICT, Json(serde_json::json!({"error": e}))).into_response(),
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
        let _ = state.db.update_user_field(user_id, "password", pw).await;
    }
    if let Some(ref fn_) = body.full_name {
        let _ = state.db.update_user_field(user_id, "full_name", fn_).await;
    }
    if let Some(ref e) = body.email {
        let _ = state.db.update_user_field(user_id, "email", e).await;
    }
    if let Some(ref role) = body.role {
        let _ = state.db.update_user_field(user_id, "role", role).await;
    }
    if let Some(active) = body.active {
        let _ = state.db.update_user_active(user_id, active).await;
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

    let _ = state.db.delete_user(user_id).await;
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

    match state.db.list_equivalences().await {
        Ok(rows) => {
            let eq: Vec<EquivalenceDto> = rows.into_iter().map(|row| EquivalenceDto {
                signal_id: row.get_i64(0),
                internal_name: row.get_string(1),
                numeric_value: row.get_f64(2),
                display_name: row.get_string(3),
            }).collect();
            Json(eq).into_response()
        }
        Err(e) => db_err(e).into_response(),
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

    match state.db.get_or_create_signal(&body.internal_name).await {
        Ok(sid) => {
            match state.db.upsert_equivalence(sid, body.numeric_value, &body.display_name).await {
                Ok(_) => Json(serde_json::json!({"ok": true, "signal_id": sid})).into_response(),
                Err(e) => db_err(e).into_response(),
            }
        }
        Err(e) => db_err(e).into_response(),
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

    let _ = state.db.delete_equivalence(params.signal_id, params.numeric_value).await;
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
    match state.db.list_patients().await {
        Ok(rows) => {
            let pts: Vec<PatientDto> = rows.into_iter().map(|row| PatientDto {
                id: row.get_i64(0),
                patient_id_str: row.get_string(1),
                created_at: row.get_string(2),
            }).collect();
            Json(pts).into_response()
        }
        Err(e) => db_err(e).into_response(),
    }
}

/// GET /api/history?patient=XYZ&limit=500
pub async fn patient_history(
    State(state): State<ApiState>,
    Query(params): Query<HistoryQuery>,
) -> impl IntoResponse {
    match state.db.patient_history(&params.patient, params.limit).await {
        Ok(rows) => {
            let data: Vec<HistoryRowDto> = rows.into_iter().map(|row| {
                let phys_str = row.get_string(3);
                let physical_value = if let Ok(n) = phys_str.parse::<f64>() {
                    TelemetryValue::Number(n)
                } else {
                    TelemetryValue::String(phys_str)
                };
                HistoryRowDto {
                    id: row.get_i64(0),
                    timestamp: row.get_string(1),
                    internal_name: row.get_string(2),
                    physical_value,
                    display_value: row.get_optional_string(4),
                    unit: row.get_string(5),
                }
            }).collect();
            Json(data).into_response()
        }
        Err(e) => db_err(e).into_response(),
    }
}

/// GET /api/export?patient=XYZ&limit=5000
pub async fn export_csv(
    State(state): State<ApiState>,
    Query(params): Query<ExportQuery>,
) -> impl IntoResponse {
    match state.db.export_history(&params.patient, params.limit).await {
        Ok(rows) => {
            let mut csv = String::from("\u{FEFF}Timestamp,Parameter,Value,Display,Unit\n");
            for row in rows {
                let ts = row.get_string(0);
                let name = row.get_string(1);
                let val_str = row.get_string(2);
                let disp = row.get_optional_string(3).unwrap_or_default();
                let unit = row.get_string(4);
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
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e).into_response(),
    }
}

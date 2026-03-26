//! HTTP REST API: Auth, Users, Equivalences, Telemetry history.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use axum::extract::{Path, Query, State};
use axum::http::{StatusCode, HeaderMap};
use axum::response::IntoResponse;
use axum::Json;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

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
    pub db: Arc<Mutex<Connection>>,
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
    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(_) => return db_err("db lock".into()).into_response(),
    };

    let result = conn.query_row(
        "SELECT id, username, password, full_name, email, role, active, created_at FROM users WHERE username = ?1",
        rusqlite::params![body.username],
        |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?, // full_name
                row.get::<_, String>(4)?, // email
                row.get::<_, String>(5)?, // role
                row.get::<_, bool>(6)?,   // active
                row.get::<_, String>(7)?, // created_at
            ))
        },
    );

    match result {
        Ok((id, username, password, full_name, email, role, active, created_at)) => {
            if !active {
                return (StatusCode::FORBIDDEN, Json(serde_json::json!({"error": "Account disabled"}))).into_response();
            }
            if password != body.password {
                return (StatusCode::UNAUTHORIZED, Json(serde_json::json!({"error": "Invalid credentials"}))).into_response();
            }

            let token = generate_token();
            let user = UserDto { id, username: username.clone(), full_name: full_name.clone(), email: email.clone(), role: role.clone(), active, created_at };
            let session = Session { user_id: id, username, full_name, email, role };

            drop(conn); // release DB lock before locking sessions
            if let Ok(mut sessions) = state.sessions.lock() {
                sessions.insert(token.clone(), session);
            }

            Json(LoginResponse { token, user }).into_response()
        }
        Err(_) => {
            (StatusCode::UNAUTHORIZED, Json(serde_json::json!({"error": "Invalid credentials"}))).into_response()
        }
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

    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(_) => return db_err("db lock".into()).into_response(),
    };

    let mut stmt = match conn.prepare("SELECT id, username, full_name, email, role, active, created_at FROM users ORDER BY id") {
        Ok(s) => s,
        Err(e) => return db_err(e.to_string()).into_response(),
    };

    let users: Vec<UserDto> = stmt.query_map([], |row| {
        Ok(UserDto {
            id: row.get(0)?,
            username: row.get(1)?,
            full_name: row.get(2)?,
            email: row.get(3)?,
            role: row.get(4)?,
            active: row.get(5)?,
            created_at: row.get(6)?,
        })
    }).unwrap().filter_map(|r| r.ok()).collect();

    Json(users).into_response()
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

    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(_) => return db_err("db lock".into()).into_response(),
    };

    let full_name = body.full_name.unwrap_or_default();
    let email = body.email.unwrap_or_default();

    match conn.execute(
        "INSERT INTO users (username, password, full_name, email, role) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![body.username, body.password, full_name, email, body.role],
    ) {
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
            return forbidden().into_response(); // only admin can change roles
        }
        if !["admin", "operator", "viewer"].contains(&role.as_str()) {
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Invalid role"}))).into_response();
        }
    }

    if body.active.is_some() && !is_admin {
        return forbidden().into_response(); // only admin can disable/enable accounts
    }

    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(_) => return db_err("db lock".into()).into_response(),
    };

    if let Some(ref pw) = body.password {
        let _ = conn.execute("UPDATE users SET password = ?1 WHERE id = ?2", rusqlite::params![pw, user_id]);
    }
    if let Some(ref fn_) = body.full_name {
        let _ = conn.execute("UPDATE users SET full_name = ?1 WHERE id = ?2", rusqlite::params![fn_, user_id]);
    }
    if let Some(ref e) = body.email {
        let _ = conn.execute("UPDATE users SET email = ?1 WHERE id = ?2", rusqlite::params![e, user_id]);
    }
    if let Some(ref role) = body.role {
        let _ = conn.execute("UPDATE users SET role = ?1 WHERE id = ?2", rusqlite::params![role, user_id]);
    }
    if let Some(active) = body.active {
        let _ = conn.execute("UPDATE users SET active = ?1 WHERE id = ?2", rusqlite::params![active, user_id]);
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

    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(_) => return db_err("db lock".into()).into_response(),
    };

    let _ = conn.execute("DELETE FROM users WHERE id = ?1", rusqlite::params![user_id]);
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

    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(_) => return db_err("db lock".into()).into_response(),
    };

    let mut stmt = match conn.prepare(
        "SELECT ae.signal_id, s.internal_name, ae.numeric_value, ae.display_name
         FROM attribute_equivalences ae
         JOIN signals s ON ae.signal_id = s.id
         ORDER BY s.internal_name, ae.numeric_value"
    ) {
        Ok(s) => s,
        Err(e) => return db_err(e.to_string()).into_response(),
    };

    let rows: Vec<EquivalenceDto> = stmt.query_map([], |row| {
        Ok(EquivalenceDto {
            signal_id: row.get(0)?,
            internal_name: row.get(1)?,
            numeric_value: row.get(2)?,
            display_name: row.get(3)?,
        })
    }).unwrap().filter_map(|r| r.ok()).collect();

    Json(rows).into_response()
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

    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(_) => return db_err("db lock".into()).into_response(),
    };

    // Ensure signal exists
    let _ = conn.execute(
        "INSERT OR IGNORE INTO signals (internal_name) VALUES (?1)",
        rusqlite::params![body.internal_name],
    );

    let signal_id: Result<i64, _> = conn.query_row(
        "SELECT id FROM signals WHERE internal_name = ?1",
        rusqlite::params![body.internal_name],
        |r| r.get(0),
    );

    match signal_id {
        Ok(sid) => {
            match conn.execute(
                "INSERT OR REPLACE INTO attribute_equivalences (signal_id, numeric_value, display_name) VALUES (?1, ?2, ?3)",
                rusqlite::params![sid, body.numeric_value, body.display_name],
            ) {
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

    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(_) => return db_err("db lock".into()).into_response(),
    };

    let _ = conn.execute(
        "DELETE FROM attribute_equivalences WHERE signal_id = ?1 AND numeric_value = ?2",
        rusqlite::params![params.signal_id, params.numeric_value],
    );

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
    pub physical_value: f64,
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
    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(_) => return db_err("db lock".into()).into_response(),
    };

    let mut stmt = match conn.prepare("SELECT id, patient_id_str, created_at FROM patients ORDER BY created_at DESC") {
        Ok(s) => s,
        Err(e) => return db_err(e.to_string()).into_response(),
    };

    let rows: Vec<PatientDto> = stmt.query_map([], |row| {
        Ok(PatientDto { id: row.get(0)?, patient_id_str: row.get(1)?, created_at: row.get(2)? })
    }).unwrap().filter_map(|r| r.ok()).collect();

    Json(rows).into_response()
}

/// GET /api/history?patient=XYZ&limit=500
pub async fn patient_history(
    State(state): State<ApiState>,
    Query(params): Query<HistoryQuery>,
) -> impl IntoResponse {
    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(_) => return db_err("db lock".into()).into_response(),
    };

    let mut stmt = match conn.prepare(
        "SELECT t.id, t.timestamp, s.internal_name, t.physical_value, e.display_name, t.unit
         FROM telemetry t
         JOIN patients p ON t.patient_id = p.id
         JOIN signals s ON t.signal_id = s.id
         LEFT JOIN attribute_equivalences e ON s.id = e.signal_id AND t.physical_value = e.numeric_value
         WHERE p.patient_id_str = ?1
         ORDER BY t.timestamp DESC LIMIT ?2"
    ) {
        Ok(s) => s,
        Err(e) => return db_err(e.to_string()).into_response(),
    };

    let rows: Vec<HistoryRowDto> = stmt.query_map(
        rusqlite::params![params.patient, params.limit],
        |row| {
            let pv: rusqlite::types::Value = row.get(3)?;
            let physical_value = match pv {
                rusqlite::types::Value::Real(n) => n,
                rusqlite::types::Value::Integer(i) => i as f64,
                _ => 0.0,
            };
            Ok(HistoryRowDto {
                id: row.get(0)?,
                timestamp: row.get(1)?,
                internal_name: row.get(2)?,
                physical_value,
                display_value: row.get(4)?,
                unit: row.get(5)?,
            })
        },
    ).unwrap().filter_map(|r| r.ok()).collect();

    Json(rows).into_response()
}

/// GET /api/export?patient=XYZ&limit=5000
pub async fn export_csv(
    State(state): State<ApiState>,
    Query(params): Query<ExportQuery>,
) -> impl IntoResponse {
    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "DB lock error".to_string()).into_response(),
    };

    let mut stmt = match conn.prepare(
        "SELECT t.timestamp, s.internal_name, t.physical_value, e.display_name, t.unit
         FROM telemetry t
         JOIN patients p ON t.patient_id = p.id
         JOIN signals s ON t.signal_id = s.id
         LEFT JOIN attribute_equivalences e ON s.id = e.signal_id AND t.physical_value = e.numeric_value
         WHERE p.patient_id_str = ?1
         ORDER BY t.timestamp ASC LIMIT ?2"
    ) {
        Ok(s) => s,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    let mut csv = String::from("\u{FEFF}Timestamp,Parameter,Value,Display,Unit\n");

    let iter = stmt.query_map(
        rusqlite::params![params.patient, params.limit],
        |row| {
            let ts: String = row.get(0)?;
            let name: String = row.get(1)?;
            let pv: rusqlite::types::Value = row.get(2)?;
            let val = match pv {
                rusqlite::types::Value::Real(n) => format!("{:.2}", n),
                rusqlite::types::Value::Integer(i) => format!("{}", i),
                _ => "0".to_string(),
            };
            let display: Option<String> = row.get(3)?;
            let unit: String = row.get(4)?;
            Ok((ts, name, val, display.unwrap_or_default(), unit))
        },
    ).unwrap();

    for item in iter {
        if let Ok((ts, name, val, disp, unit)) = item {
            csv.push_str(&format!("{},{},{},{},{}\n",
                ts.replace(',', ";"), name.replace(',', ";"),
                val, disp.replace(',', ";"), unit.replace(',', ";"),
            ));
        }
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

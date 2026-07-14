//! HTTP REST API: Auth, Users, Equivalences, Telemetry history.
//! Uses DbPool abstraction to support both SQLite and SQL Server.

use axum::Json;
use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, Request, StatusCode};
use axum::middleware::Next;
use axum::response::IntoResponse;
use serde::{Deserialize, Serialize};

use crate::domain::entities::TelemetryValue;
use crate::infrastructure::auth::{
    JwtClaims, decode_token, hash_password, issue_token, verify_password,
};
use crate::infrastructure::db_pool::DbPool;

// ─── Shared State ───────────────────────────────────────────────

#[derive(Clone)]
pub struct ApiState {
    pub db: DbPool,
    pub jwt_secret: String,
    pub jwt_token_ttl_secs: u64,
    pub serial_manager: std::sync::Arc<crate::infrastructure::serial_manager::SerialReaderManager>,
}

/// Extracts the authenticated user from either:
///  1. Authorization: Bearer <token> header (preferred)
///  2. Cookie: monitor_token=<jwt> (fallback for SPA routes)
///
/// Also verifies the user account is active in the database.
async fn get_claims(headers: &HeaderMap, state: &ApiState) -> Option<JwtClaims> {
    // 1. Try Authorization: Bearer first
    if let Some(auth) = headers.get("authorization").and_then(|v| v.to_str().ok())
        && let Some(token) = auth.strip_prefix("Bearer ")
        && let Ok(claims) = decode_token(&state.jwt_secret, token)
        && state.db.is_user_active(claims.user_id).await.ok()?
    {
        return Some(claims);
    }
    // 2. Fallback: Cookie: monitor_token=<jwt>
    if let Some(cookie_header) = headers.get("cookie").and_then(|v| v.to_str().ok()) {
        for pair in cookie_header.split(';') {
            let pair = pair.trim();
            if let Some(token) = pair.strip_prefix("monitor_token=")
                && let Ok(claims) = decode_token(&state.jwt_secret, token)
                && state.db.is_user_active(claims.user_id).await.ok()?
            {
                return Some(claims);
            }
        }
    }
    None
}

fn unauthorized() -> axum::response::Response {
    (
        StatusCode::UNAUTHORIZED,
        Json(serde_json::json!({"error": "Unauthorized"})),
    )
        .into_response()
}

fn forbidden() -> axum::response::Response {
    (
        StatusCode::FORBIDDEN,
        Json(serde_json::json!({"error": "Forbidden: insufficient role"})),
    )
        .into_response()
}

fn db_err(msg: String) -> axum::response::Response {
    tracing::error!("[API] Internal error: {}", msg);
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(serde_json::json!({"error": "Internal server error"})),
    )
        .into_response()
}

// ═══════════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════════

#[derive(Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct LoginWithTokenRequest {
    pub code: String,
}

#[derive(Deserialize)]
pub struct CallbackQuery {
    pub token: String,
    pub redirect: Option<String>,
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
                return (
                    StatusCode::FORBIDDEN,
                    Json(serde_json::json!({"error": "Account disabled"})),
                )
                    .into_response();
            }
            let password_check = verify_password(&password_hash, &body.password);
            if !password_check.verified {
                return (
                    StatusCode::UNAUTHORIZED,
                    Json(serde_json::json!({"error": "Invalid credentials"})),
                )
                    .into_response();
            }

            if password_check.needs_upgrade
                && let Ok(new_hash) = hash_password(&body.password)
            {
                let _ = state.db.update_user_password(id, &new_hash).await;
            }

            let claims = JwtClaims {
                user_id: id,
                username: username.clone(),
                full_name: full_name.clone(),
                email: email.clone(),
                role: role.clone(),
                iat: 0,
                exp: 0,
                iss: String::new(),
            };
            let token = match issue_token(
                &state.jwt_secret,
                &claims,
                std::time::Duration::from_secs(state.jwt_token_ttl_secs),
            ) {
                Ok(token) => token,
                Err(e) => return db_err(e.to_string()).into_response(),
            };
            let user = UserDto {
                id,
                username: username.clone(),
                full_name: full_name.clone(),
                email: email.clone(),
                role: role.clone(),
                active,
                created_at,
            };

            Json(LoginResponse { token, user }).into_response()
        }
        Ok(None) => (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "Invalid credentials"})),
        )
            .into_response(),
        Err(e) => db_err(e).into_response(),
    }
}

/// POST /api/auth/login-with-token
pub async fn login_with_token(
    State(state): State<ApiState>,
    Json(body): Json<LoginWithTokenRequest>,
) -> impl IntoResponse {
    let code = &body.code;

    // 1. Buscar authorization_codes WHERE code = ?
    let row = match state.db.find_authorization_code(code).await {
        Ok(Some(r)) => r,
        Ok(None) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({"error": "Token inválido"})),
            )
                .into_response()
        }
        Err(e) => return db_err(e).into_response(),
    };

    let user_id = row.get_i64(0);
    let used = row.get_bool(1);
    let expires_at = row.get_optional_string(2);

    // 2. Si used = true → error 401
    if used {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "Token ya utilizado"})),
        )
            .into_response();
    }

    // 3. Si expires_at < ahora → error 401
    if let Some(ref exp) = expires_at
        && let Ok(exp_parsed) =
            chrono::NaiveDateTime::parse_from_str(exp, "%Y-%m-%d %H:%M:%S")
                .or_else(|_| chrono::NaiveDateTime::parse_from_str(exp, "%Y-%m-%dT%H:%M:%S"))
    {
        let now = chrono::Utc::now().naive_utc();
        if exp_parsed < now {
            return (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({"error": "Token expirado"})),
            )
                .into_response();
        }
    }

    // 4. UPDATE authorization_codes SET used = 1
    if let Err(e) = state.db.mark_authorization_code_used(code).await {
        return db_err(e).into_response();
    }

    // 5. Buscar usuario por user_id
    let user_row = match state.db.find_user_by_id(user_id).await {
        Ok(Some(r)) => r,
        Ok(None) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({"error": "Usuario no encontrado"})),
            )
                .into_response()
        }
        Err(e) => return db_err(e).into_response(),
    };

    let db_id = user_row.get_i64(0);
    let username = user_row.get_string(1);
    let full_name = user_row.get_string(3);
    let email = user_row.get_string(4);
    let role = user_row.get_string(5);
    let active = user_row.get_bool(6);
    let created_at = user_row.get_string(7);

    // 6. Si usuario no activo → error 403
    if !active {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"error": "Cuenta deshabilitada"})),
        )
            .into_response();
    }

    // 7. Emitir JWT
    let claims = JwtClaims {
        user_id: db_id,
        username: username.clone(),
        full_name: full_name.clone(),
        email: email.clone(),
        role: role.clone(),
        iat: 0,
        exp: 0,
        iss: String::new(),
    };
    let token = match issue_token(
        &state.jwt_secret,
        &claims,
        std::time::Duration::from_secs(state.jwt_token_ttl_secs),
    ) {
        Ok(t) => t,
        Err(e) => return db_err(e.to_string()).into_response(),
    };

    // 8. Setear cookie y devolver respuesta
    let user = UserDto {
        id: db_id,
        username: username.clone(),
        full_name: full_name.clone(),
        email: email.clone(),
        role: role.clone(),
        active,
        created_at,
    };

    (
        StatusCode::OK,
        [(
            "Set-Cookie",
            &format!(
                "monitor_token={}; HttpOnly; SameSite=Lax; Path=/api; Max-Age={}",
                token, state.jwt_token_ttl_secs
            ),
        )],
        Json(LoginResponse { token, user }),
    )
        .into_response()
}

/// GET /api/auth/callback?token=uuid&redirect=/therapy/42
pub async fn auth_callback(
    State(state): State<ApiState>,
    Query(params): Query<CallbackQuery>,
) -> impl IntoResponse {
    let redirect = params.redirect.unwrap_or_else(|| "/".to_string());

    // Validar que redirect sea relativo (mismo origen) para evitar open redirect
    if !redirect.starts_with('/') {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Invalid redirect path"})),
        )
            .into_response();
    }

    // Misma validación que login_with_token
    let row = match state.db.find_authorization_code(&params.token).await {
        Ok(Some(r)) => r,
        _ => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({"error": "Token inválido"})),
            )
                .into_response()
        }
    };

    let user_id = row.get_i64(0);
    let used = row.get_bool(1);
    let expires_at = row.get_optional_string(2);

    if used {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "Token ya utilizado"})),
        )
            .into_response();
    }

    if let Some(ref exp) = expires_at
        && let Ok(exp_parsed) =
            chrono::NaiveDateTime::parse_from_str(exp, "%Y-%m-%d %H:%M:%S")
                .or_else(|_| chrono::NaiveDateTime::parse_from_str(exp, "%Y-%m-%dT%H:%M:%S"))
    {
        let now = chrono::Utc::now().naive_utc();
        if exp_parsed < now {
            return (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({"error": "Token expirado"})),
            )
                .into_response();
        }
    }

    if let Err(e) = state.db.mark_authorization_code_used(&params.token).await {
        return db_err(e).into_response();
    }

    let user_row = match state.db.find_user_by_id(user_id).await {
        Ok(Some(r)) => r,
        _ => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({"error": "Usuario no encontrado"})),
            )
                .into_response()
        }
    };

    let db_id = user_row.get_i64(0);
    let username = user_row.get_string(1);
    let full_name = user_row.get_string(3);
    let email = user_row.get_string(4);
    let role = user_row.get_string(5);
    let active = user_row.get_bool(6);

    if !active {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"error": "Cuenta deshabilitada"})),
        )
            .into_response();
    }

    let claims = JwtClaims {
        user_id: db_id,
        username: username.clone(),
        full_name: full_name.clone(),
        email: email.clone(),
        role: role.clone(),
        iat: 0,
        exp: 0,
        iss: String::new(),
    };
    let token = match issue_token(
        &state.jwt_secret,
        &claims,
        std::time::Duration::from_secs(state.jwt_token_ttl_secs),
    ) {
        Ok(t) => t,
        Err(e) => return db_err(e.to_string()).into_response(),
    };

    // Setear cookie y redirigir
    (
        [
            (
                "Set-Cookie",
                &format!(
                    "monitor_token={}; HttpOnly; SameSite=Lax; Path=/api; Max-Age={}",
                    token, state.jwt_token_ttl_secs
                ),
            ),
            ("Location", &redirect),
        ],
        StatusCode::FOUND,
    )
        .into_response()
}

/// Tower middleware that intercepts GET requests with `?token_permanente=<code>`,
/// validates the authorization code, sets the `monitor_token` cookie, and
/// redirects to the same path without the query parameter.
///
/// Only processes `/api/*` routes. SPA routes (e.g. `/therapy/42`) pass through
/// so the frontend can read `token_permanente` from the URL and exchange it via
/// `POST /api/auth/login-with-token`.
pub async fn token_permanente_middleware(
    State(state): State<ApiState>,
    request: Request<Body>,
    next: Next,
) -> impl IntoResponse {
    // Solo procesar GET requests
    if request.method() != axum::http::Method::GET {
        return next.run(request).await.into_response();
    }

    // No interferir con rutas SPA — el frontend maneja el token via API
    if !request.uri().path().starts_with("/api") {
        return next.run(request).await.into_response();
    }

    // Extraer query params manualmente (sin dependencias extra)
    let query = request.uri().query().unwrap_or("");
    let token_code: Option<String> = {
        let pairs: Vec<&str> = query.split('&').collect();
        let mut result = None;
        for pair in pairs {
            if let Some((k, v)) = pair.split_once('=')
                && k == "token_permanente"
            {
                result = Some(v.to_string());
                break;
            }
        }
        result
    };

    let Some(code) = token_code else {
        return next.run(request).await.into_response();
    };

    // Validar el código
    let row = match state.db.find_authorization_code(&code).await {
        Ok(Some(r)) => r,
        _ => return next.run(request).await.into_response(),
    };

    let user_id = row.get_i64(0);
    let used = row.get_bool(1);
    let expires_at = row.get_optional_string(2);

    if used {
        return next.run(request).await.into_response();
    }

    if let Some(ref exp) = expires_at
        && let Ok(exp_parsed) =
            chrono::NaiveDateTime::parse_from_str(exp, "%Y-%m-%d %H:%M:%S")
                .or_else(|_| chrono::NaiveDateTime::parse_from_str(exp, "%Y-%m-%dT%H:%M:%S"))
    {
        let now = chrono::Utc::now().naive_utc();
        if exp_parsed < now {
            return next.run(request).await.into_response();
        }
    }

    if state.db.mark_authorization_code_used(&code).await.is_err() {
        return next.run(request).await.into_response();
    }

    let user_row = match state.db.find_user_by_id(user_id).await {
        Ok(Some(r)) => r,
        _ => return next.run(request).await.into_response(),
    };

    let db_id = user_row.get_i64(0);
    let username = user_row.get_string(1);
    let full_name = user_row.get_string(3);
    let email = user_row.get_string(4);
    let role = user_row.get_string(5);
    let active = user_row.get_bool(6);

    if !active {
        return next.run(request).await.into_response();
    }

    let claims = JwtClaims {
        user_id: db_id,
        username: username.clone(),
        full_name: full_name.clone(),
        email: email.clone(),
        role: role.clone(),
        iat: 0,
        exp: 0,
        iss: String::new(),
    };
    let jwt = match issue_token(
        &state.jwt_secret,
        &claims,
        std::time::Duration::from_secs(state.jwt_token_ttl_secs),
    ) {
        Ok(t) => t,
        Err(_) => return next.run(request).await.into_response(),
    };

    // Construir redirect URI sin el query param token_permanente
    let path = request.uri().path().to_string();
    let remaining_pairs: Vec<&str> = query
        .split('&')
        .filter(|pair| !pair.starts_with("token_permanente=") && !pair.is_empty())
        .collect();
    let redirect = if remaining_pairs.is_empty() {
        path
    } else {
        format!("{}?{}", path, remaining_pairs.join("&"))
    };

    // 302 redirect con Set-Cookie
    (
        [
            (
                "Set-Cookie",
                &format!(
                    "monitor_token={}; HttpOnly; SameSite=Lax; Path=/api; Max-Age={}",
                    jwt, state.jwt_token_ttl_secs
                ),
            ),
            ("Location", &redirect),
        ],
        StatusCode::FOUND,
    )
        .into_response()
}

/// POST /api/auth/logout
pub async fn logout(State(state): State<ApiState>, headers: HeaderMap) -> impl IntoResponse {
    let _ = (state, headers);
    Json(serde_json::json!({"ok": true})).into_response()
}

/// GET /api/auth/me
pub async fn get_me(State(state): State<ApiState>, headers: HeaderMap) -> impl IntoResponse {
    match get_claims(&headers, &state).await {
        Some(session) => Json(serde_json::json!({
            "user_id": session.user_id,
            "username": session.username,
            "full_name": session.full_name,
            "email": session.email,
            "role": session.role,
        }))
        .into_response(),
        None => unauthorized().into_response(),
    }
}

// ═══════════════════════════════════════════════════════════════
//  USERS CRUD (admin only)
// ═══════════════════════════════════════════════════════════════

/// GET /api/users
pub async fn list_users(State(state): State<ApiState>, headers: HeaderMap) -> impl IntoResponse {
    let session = match get_claims(&headers, &state).await {
        Some(s) => s,
        None => return unauthorized().into_response(),
    };
    if session.role != "admin" {
        return forbidden().into_response();
    }

    match state.db.list_users().await {
        Ok(rows) => {
            let users: Vec<UserDto> = rows
                .into_iter()
                .map(|row| UserDto {
                    id: row.get_i64(0),
                    username: row.get_string(1),
                    full_name: row.get_string(2),
                    email: row.get_string(3),
                    role: row.get_string(4),
                    active: row.get_bool(5),
                    created_at: row.get_string(6),
                })
                .collect();
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
    let session = match get_claims(&headers, &state).await {
        Some(s) => s,
        None => return unauthorized().into_response(),
    };
    if session.role != "admin" {
        return forbidden().into_response();
    }

    if !["admin", "operator", "viewer"].contains(&body.role.as_str()) {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Invalid role. Must be: admin, operator, viewer"})),
        )
            .into_response();
    }

    let full_name = body.full_name.unwrap_or_default();
    let email = body.email.unwrap_or_default();

    let password_hash = match hash_password(&body.password) {
        Ok(hash) => hash,
        Err(e) => return db_err(e.to_string()).into_response(),
    };

    match state
        .db
        .insert_user(
            &body.username,
            &password_hash,
            &full_name,
            &email,
            &body.role,
        )
        .await
    {
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
    let session = match get_claims(&headers, &state).await {
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
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid role"})),
            )
                .into_response();
        }
    }

    if body.active.is_some() && !is_admin {
        return forbidden().into_response();
    }

    let mut errors: Vec<String> = Vec::new();

    if let Some(ref pw) = body.password {
        let password_hash = match hash_password(pw) {
            Ok(hash) => hash,
            Err(e) => return db_err(e.to_string()).into_response(),
        };
        if let Err(e) = state.db.update_user_password(user_id, &password_hash).await {
            errors.push(format!("password: {e}"));
        }
    }
    if let Some(ref fn_) = body.full_name
        && let Err(e) = state.db.update_user_full_name(user_id, fn_).await
    {
        errors.push(format!("full_name: {e}"));
    }
    if let Some(ref e) = body.email
        && let Err(e) = state.db.update_user_email(user_id, e).await
    {
        errors.push(format!("email: {e}"));
    }
    if let Some(ref role) = body.role
        && let Err(e) = state.db.update_user_role(user_id, role).await
    {
        errors.push(format!("role: {e}"));
    }
    if let Some(active) = body.active
        && let Err(e) = state.db.update_user_active(user_id, active).await
    {
        errors.push(format!("active: {e}"));
    }

    if !errors.is_empty() {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": format!("Partial update failure: {}", errors.join("; "))}))).into_response();
    }

    Json(serde_json::json!({"ok": true})).into_response()
}

/// DELETE /api/users/:id
pub async fn delete_user(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(user_id): Path<i64>,
) -> impl IntoResponse {
    let session = match get_claims(&headers, &state).await {
        Some(s) => s,
        None => return unauthorized().into_response(),
    };
    if session.role != "admin" {
        return forbidden().into_response();
    }
    // Prevent self-deletion
    if session.user_id == user_id {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Cannot delete yourself"})),
        )
            .into_response();
    }

    if let Err(e) = state.db.delete_user(user_id).await {
        return db_err(e.to_string()).into_response();
    }
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
    if get_claims(&headers, &state).await.is_none() {
        return unauthorized().into_response();
    }

    match state.db.list_equivalences().await {
        Ok(rows) => {
            let eq: Vec<EquivalenceDto> = rows
                .into_iter()
                .map(|row| EquivalenceDto {
                    signal_id: row.get_i64(0),
                    internal_name: row.get_string(1),
                    numeric_value: row.get_f64(2),
                    display_name: row.get_string(3),
                })
                .collect();
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
    let session = match get_claims(&headers, &state).await {
        Some(s) => s,
        None => return unauthorized().into_response(),
    };
    if session.role == "viewer" {
        return forbidden().into_response();
    }

    match state.db.get_or_create_signal(&body.internal_name).await {
        Ok(sid) => {
            match state
                .db
                .upsert_equivalence(sid, body.numeric_value, &body.display_name)
                .await
            {
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

#[derive(Deserialize)]
pub struct UpdateEquivalenceRequest {
    pub signal_id: i64,
    pub numeric_value: f64,
    pub display_name: String,
}

#[derive(Deserialize)]
pub struct DeleteEquivalenceBody {
    pub deleted_by: String,
    pub deletion_reason: String,
}

/// PUT /api/equivalences
pub async fn update_equivalence(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Json(body): Json<UpdateEquivalenceRequest>,
) -> impl IntoResponse {
    let session = match get_claims(&headers, &state).await {
        Some(s) => s,
        None => return unauthorized().into_response(),
    };
    if session.role == "viewer" {
        return forbidden().into_response();
    }

    if body.display_name.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "El nombre mostrado no puede estar vacío"})),
        )
            .into_response();
    }

    match state
        .db
        .update_equivalence(body.signal_id, body.numeric_value, &body.display_name)
        .await
    {
        Ok(_) => Json(serde_json::json!({"ok": true})).into_response(),
        Err(e) => db_err(e).into_response(),
    }
}

// ─── SIGNALS ───────────────────────────────────────────────

#[derive(Serialize)]
pub struct SignalDto {
    pub id: i64,
    pub internal_name: String,
    pub display_name: Option<String>,
    pub unit: Option<String>,
}

/// GET /api/signals
pub async fn list_signals(
    State(state): State<ApiState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if get_claims(&headers, &state).await.is_none() {
        return unauthorized().into_response();
    }

    match state.db.list_signals().await {
        Ok(rows) => {
            let signals: Vec<SignalDto> = rows
                .into_iter()
                .map(|row| SignalDto {
                    id: row.get_i64(0),
                    internal_name: row.get_string(1),
                    display_name: row.get_optional_string(2),
                    unit: row.get_optional_string(3),
                })
                .collect();
            Json(signals).into_response()
        }
        Err(e) => db_err(e).into_response(),
    }
}

#[derive(Deserialize)]
pub struct UpdateSignalRequest {
    pub display_name: Option<String>,
    pub unit: Option<String>,
}

/// PUT /api/signals/{id}
pub async fn update_signal(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(signal_id): Path<i64>,
    Json(body): Json<UpdateSignalRequest>,
) -> impl IntoResponse {
    let session = match get_claims(&headers, &state).await {
        Some(s) => s,
        None => return unauthorized().into_response(),
    };
    if session.role != "admin" {
        return forbidden().into_response();
    }

    match state
        .db
        .update_signal(
            signal_id,
            body.display_name.as_deref(),
            body.unit.as_deref(),
        )
        .await
    {
        Ok(_) => Json(serde_json::json!({"ok": true})).into_response(),
        Err(e) => db_err(e).into_response(),
    }
}

/// DELETE /api/equivalences
pub async fn delete_equivalence(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Query(params): Query<DeleteEquivalenceQuery>,
    Json(body): Json<DeleteEquivalenceBody>,
) -> impl IntoResponse {
    let session = match get_claims(&headers, &state).await {
        Some(s) => s,
        None => return unauthorized().into_response(),
    };
    if session.role != "admin" {
        return forbidden().into_response();
    }

    if body.deleted_by.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "El nombre del usuario no puede estar vacío"})),
        )
            .into_response();
    }
    if body.deletion_reason.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "El motivo de eliminación no puede estar vacío"})),
        )
            .into_response();
    }

    match state
        .db
        .delete_equivalence_with_log(
            params.signal_id,
            params.numeric_value,
            &body.deleted_by,
            &body.deletion_reason,
        )
        .await
    {
        Ok(_) => Json(serde_json::json!({"ok": true})).into_response(),
        Err(e) => db_err(e).into_response(),
    }
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
pub struct TherapyDto {
    pub id: i64,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub status: String,
    pub patient_id: i64,
    pub patient_id_str: String,
    pub machine_id: i64,
    pub serial_number: String,
    pub software_version: String,
    pub serial_session_id: Option<i64>,
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

/// Maximum rows the API will ever return for a single history/export request.
const MAX_HISTORY_LIMIT: u32 = 5_000;
/// Maximum rows per page for paginated endpoints.
const MAX_PAGE_SIZE: i64 = 200;

#[derive(Deserialize)]
pub struct HistoryQuery {
    pub patient: String,
    #[serde(default = "default_limit")]
    pub limit: u32,
}
fn default_limit() -> u32 {
    500
}

#[derive(Deserialize)]
pub struct ExportQuery {
    pub patient: String,
    #[serde(default = "default_export_limit")]
    pub limit: u32,
}
fn default_export_limit() -> u32 {
    5000
}

#[derive(Deserialize)]
pub struct TherapyHistoryQuery {
    pub therapy_id: i64,
    #[serde(default = "default_limit")]
    pub limit: u32,
}

#[derive(Deserialize)]
pub struct TherapyExportQuery {
    pub therapy_id: i64,
    #[serde(default = "default_export_limit")]
    pub limit: u32,
}

/// GET /api/patients
pub async fn list_patients(headers: HeaderMap, State(state): State<ApiState>) -> impl IntoResponse {
    if get_claims(&headers, &state).await.is_none() {
        return unauthorized();
    }
    match state.db.list_patients().await {
        Ok(rows) => {
            let pts: Vec<PatientDto> = rows
                .into_iter()
                .map(|row| PatientDto {
                    id: row.get_i64(0),
                    patient_id_str: row.get_string(1),
                    created_at: row.get_string(2),
                })
                .collect();
            Json(pts).into_response()
        }
        Err(e) => db_err(e).into_response(),
    }
}

#[derive(Deserialize)]
pub struct TherapiesQuery {
    pub search: Option<String>,
    pub status: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    #[serde(default = "default_therapies_page")]
    pub page: i64,
    #[serde(default = "default_therapies_page_size")]
    pub page_size: i64,
}
fn default_therapies_page() -> i64 {
    1
}
fn default_therapies_page_size() -> i64 {
    30
}

#[derive(Serialize)]
pub struct TherapiesResponse {
    pub therapies: Vec<TherapyDto>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

/// GET /api/therapies?search=&status=&page=1&page_size=30
pub async fn list_therapies(
    headers: HeaderMap,
    State(state): State<ApiState>,
    Query(params): Query<TherapiesQuery>,
) -> impl IntoResponse {
    if get_claims(&headers, &state).await.is_none() {
        return unauthorized();
    }

    // Clamp page_size to prevent excessively large responses.
    let page_size = params.page_size.clamp(1, MAX_PAGE_SIZE);
    let page = params.page.max(1);

    match state
        .db
        .list_therapies(
            params.search.as_deref(),
            params.status.as_deref(),
            params.date_from.as_deref(),
            params.date_to.as_deref(),
            page,
            page_size,
        )
        .await
    {
        Ok((rows, total)) => {
            let therapies: Vec<TherapyDto> = rows
                .into_iter()
                .map(|row| TherapyDto {
                    id: row.get_i64(0),
                    started_at: row.get_string(1),
                    ended_at: row.get_optional_string(2),
                    status: row.get_string(3),
                    patient_id: row.get_i64(4),
                    patient_id_str: row.get_string(5),
                    machine_id: row.get_i64(6),
                    serial_number: row.get_string(7),
                    software_version: row.get_string(8),
                    serial_session_id: row.get_optional_i64(9),
                })
                .collect();
            Json(TherapiesResponse {
                therapies,
                total,
                page,
                page_size,
            })
            .into_response()
        }
        Err(e) => db_err(e).into_response(),
    }
}

/// GET /api/history?patient=XYZ&limit=500
pub async fn patient_history(
    headers: HeaderMap,
    State(state): State<ApiState>,
    Query(params): Query<HistoryQuery>,
) -> impl IntoResponse {
    if get_claims(&headers, &state).await.is_none() {
        return unauthorized();
    }
    let limit = params.limit.clamp(1, MAX_HISTORY_LIMIT);
    match state
        .db
        .patient_history(&params.patient, limit)
        .await
    {
        Ok(rows) => {
            let data: Vec<HistoryRowDto> = rows
                .into_iter()
                .map(|row| {
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
                })
                .collect();
            Json(data).into_response()
        }
        Err(e) => db_err(e).into_response(),
    }
}

/// GET /api/therapy-history?therapy_id=123&limit=500
pub async fn therapy_history(
    headers: HeaderMap,
    State(state): State<ApiState>,
    Query(params): Query<TherapyHistoryQuery>,
) -> impl IntoResponse {
    if get_claims(&headers, &state).await.is_none() {
        return unauthorized();
    }
    let limit = params.limit.clamp(1, MAX_HISTORY_LIMIT);
    match state
        .db
        .therapy_history(params.therapy_id, limit)
        .await
    {
        Ok(rows) => {
            let data: Vec<HistoryRowDto> = rows
                .into_iter()
                .map(|row| {
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
                })
                .collect();
            Json(data).into_response()
        }
        Err(e) => db_err(e).into_response(),
    }
}

/// GET /api/export?patient=XYZ&limit=5000
pub async fn export_csv(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Query(params): Query<ExportQuery>,
) -> impl IntoResponse {
    let session = match get_claims(&headers, &state).await {
        Some(s) => s,
        None => return unauthorized().into_response(),
    };
    if session.role != "admin" && session.role != "operator" {
        return forbidden().into_response();
    }
    let limit = params.limit.clamp(1, MAX_HISTORY_LIMIT);
    match state.db.export_history(&params.patient, limit).await {
        Ok(rows) => {
            let mut csv = String::from("\u{FEFF}Timestamp,Parameter,Value,Display,Unit\n");
            for row in rows {
                let ts = row.get_string(0);
                let name = row.get_string(1);
                let val_str = row.get_string(2);
                let disp = row.get_optional_string(3).unwrap_or_default();
                let unit = row.get_string(4);
                csv.push_str(&format!(
                    "{},{},{},{},{}\n",
                    ts.replace(',', ";"),
                    name.replace(',', ";"),
                    val_str,
                    disp.replace(',', ";"),
                    unit.replace(',', ";")
                ));
            }

            let filename = format!("omni_report_{}.csv", params.patient);
            (
                StatusCode::OK,
                [
                    ("Content-Type", "text/csv; charset=utf-8"),
                    (
                        "Content-Disposition",
                        &format!("attachment; filename=\"{}\"", filename),
                    ),
                ],
                csv,
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("[API] Export error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                axum::Json(serde_json::json!({"error": "Internal server error"})),
            )
                .into_response()
        }
    }
}

#[derive(Serialize)]
pub struct SessionReadingDto {
    pub id: i64,
    pub timestamp: String,
    pub internal_name: String,
    pub raw_value: i64,
    pub physical_value: TelemetryValue,
    pub unit: String,
    pub display_value: Option<String>,
    pub phase: Option<String>,
}

#[derive(Deserialize)]
pub struct SessionReadingsQuery {
    #[serde(default = "default_limit")]
    pub limit: u32,
}

/// GET /api/sessions/{id}/readings?limit=500
pub async fn get_session_readings(
    headers: HeaderMap,
    State(state): State<ApiState>,
    Path(session_id): Path<i64>,
    Query(params): Query<SessionReadingsQuery>,
) -> impl IntoResponse {
    if get_claims(&headers, &state).await.is_none() {
        return unauthorized();
    }
    let limit = params.limit.clamp(1, MAX_HISTORY_LIMIT);
    match state
        .db
        .list_session_readings(session_id, limit)
        .await
    {
        Ok(rows) => {
            let data: Vec<SessionReadingDto> = rows
                .into_iter()
                .map(|row| {
                    let phys_str = row.get_string(3);
                    let physical_value = if let Ok(n) = phys_str.parse::<f64>() {
                        TelemetryValue::Number(n)
                    } else {
                        TelemetryValue::String(phys_str)
                    };
                    SessionReadingDto {
                        id: row.get_i64(0),
                        timestamp: row.get_string(1),
                        internal_name: row.get_string(2),
                        raw_value: row.get_i64(4),
                        physical_value,
                        unit: row.get_string(5),
                        display_value: row.get_optional_string(6),
                        phase: row.get_optional_string(7),
                    }
                })
                .collect();
            Json(data).into_response()
        }
        Err(e) => db_err(e).into_response(),
    }
}

/// GET /api/therapy-export?therapy_id=123&limit=5000
pub async fn export_therapy_csv(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Query(params): Query<TherapyExportQuery>,
) -> impl IntoResponse {
    let session = match get_claims(&headers, &state).await {
        Some(s) => s,
        None => return unauthorized().into_response(),
    };
    if session.role != "admin" && session.role != "operator" {
        return forbidden().into_response();
    }
    let limit = params.limit.clamp(1, MAX_HISTORY_LIMIT);
    match state
        .db
        .export_therapy_history(params.therapy_id, limit)
        .await
    {
        Ok(rows) => {
            let mut csv = String::from("\u{FEFF}Timestamp,Parameter,Value,Display,Unit\n");
            for row in rows {
                let ts = row.get_string(0);
                let name = row.get_string(1);
                let val_str = row.get_string(2);
                let disp = row.get_optional_string(3).unwrap_or_default();
                let unit = row.get_string(4);
                csv.push_str(&format!(
                    "{},{},{},{},{}\n",
                    ts.replace(',', ";"),
                    name.replace(',', ";"),
                    val_str,
                    disp.replace(',', ";"),
                    unit.replace(',', ";")
                ));
            }

            let filename = format!("omni_therapy_{}_report.csv", params.therapy_id);
            (
                StatusCode::OK,
                [
                    ("Content-Type", "text/csv; charset=utf-8"),
                    (
                        "Content-Disposition",
                        &format!("attachment; filename=\"{}\"", filename),
                    ),
                ],
                csv,
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("[API] Export error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                axum::Json(serde_json::json!({"error": "Internal server error"})),
            )
                .into_response()
        }
    }
}

// ═══════════════════════════════════════════════
//  SERIAL READER CONTROL
// ═══════════════════════════════════════════════

/// GET /api/serial/status
pub async fn serial_status(State(state): State<ApiState>, headers: HeaderMap) -> impl IntoResponse {
    if get_claims(&headers, &state).await.is_none() {
        return unauthorized().into_response();
    }

    let status = state.serial_manager.get_status().await;
    Json(status).into_response()
}

#[derive(Deserialize)]
pub struct StartSerialPayload {
    new_therapy: Option<bool>,
}

#[derive(Deserialize)]
pub struct StopSerialPayload {
    close_therapy: Option<bool>,
}

/// POST /api/serial/start
pub async fn serial_start(
    State(state): State<ApiState>,
    headers: HeaderMap,
    payload: Option<Json<StartSerialPayload>>,
) -> impl IntoResponse {
    let session = match get_claims(&headers, &state).await {
        Some(s) => s,
        None => return unauthorized().into_response(),
    };
    if session.role != "admin" && session.role != "operator" {
        return forbidden().into_response();
    }

    let new_therapy = payload.and_then(|Json(p)| p.new_therapy).unwrap_or(false);
    state.serial_manager.start(new_therapy).await;
    Json(serde_json::json!({"ok": true})).into_response()
}

/// POST /api/serial/stop
pub async fn serial_stop(
    State(state): State<ApiState>,
    headers: HeaderMap,
    payload: Option<Json<StopSerialPayload>>,
) -> impl IntoResponse {
    let session = match get_claims(&headers, &state).await {
        Some(s) => s,
        None => return unauthorized().into_response(),
    };
    if session.role != "admin" && session.role != "operator" {
        return forbidden().into_response();
    }

    let close_therapy = payload.and_then(|Json(p)| p.close_therapy).unwrap_or(true);
    state.serial_manager.stop(close_therapy).await;
    Json(serde_json::json!({"ok": true})).into_response()
}

// ═══════════════════════════════════════════════
//  THERAPY COMMENTS
// ═══════════════════════════════════════════════

#[derive(Serialize)]
pub struct TherapyCommentDto {
    pub id: i64,
    pub therapy_id: i64,
    pub author_name: String,
    pub comment: String,
    pub created_at: String,
    pub deleted_at: Option<String>,
    pub deletion_reason: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateCommentRequest {
    pub author_name: String,
    pub comment: String,
}

#[derive(Deserialize)]
pub struct DeleteCommentRequest {
    pub reason: String,
}

/// GET /api/therapies/{id}/comments
pub async fn list_comments(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(therapy_id): Path<i64>,
) -> impl IntoResponse {
    if get_claims(&headers, &state).await.is_none() {
        return unauthorized().into_response();
    }

    match state.db.list_therapy_comments(therapy_id).await {
        Ok(rows) => {
            let comments: Vec<TherapyCommentDto> = rows
                .into_iter()
                .map(|row| TherapyCommentDto {
                    id: row.get_i64(0),
                    therapy_id: row.get_i64(1),
                    author_name: row.get_string(2),
                    comment: row.get_string(3),
                    created_at: row.get_string(4),
                    deleted_at: if row.get_string(5).is_empty() {
                        None
                    } else {
                        Some(row.get_string(5))
                    },
                    deletion_reason: if row.get_string(6).is_empty() {
                        None
                    } else {
                        Some(row.get_string(6))
                    },
                })
                .collect();
            Json(comments).into_response()
        }
        Err(e) => db_err(e).into_response(),
    }
}

/// POST /api/therapies/{id}/comments
pub async fn create_comment(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(therapy_id): Path<i64>,
    Json(body): Json<CreateCommentRequest>,
) -> impl IntoResponse {
    let session = match get_claims(&headers, &state).await {
        Some(s) => s,
        None => return unauthorized().into_response(),
    };
    if session.role == "viewer" {
        return forbidden().into_response();
    }

    if body.author_name.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Author name cannot be empty"})),
        )
            .into_response();
    }
    if body.comment.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Comment cannot be empty"})),
        )
            .into_response();
    }

    match state
        .db
        .create_therapy_comment(therapy_id, &body.author_name, &body.comment)
        .await
    {
        Ok(id) => {
            let comment = TherapyCommentDto {
                id,
                therapy_id,
                author_name: body.author_name,
                comment: body.comment,
                created_at: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                deleted_at: None,
                deletion_reason: None,
            };
            (StatusCode::CREATED, Json(comment)).into_response()
        }
        Err(e) => db_err(e).into_response(),
    }
}

/// DELETE /api/therapies/comments/{comment_id}
pub async fn delete_comment(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(comment_id): Path<i64>,
    Json(body): Json<DeleteCommentRequest>,
) -> impl IntoResponse {
    let session = match get_claims(&headers, &state).await {
        Some(s) => s,
        None => return unauthorized().into_response(),
    };
    if session.role != "admin" {
        return forbidden().into_response();
    }

    if body.reason.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Deletion reason cannot be empty"})),
        )
            .into_response();
    }

    match state
        .db
        .soft_delete_therapy_comment(comment_id, &body.reason)
        .await
    {
        Ok(_) => Json(serde_json::json!({"ok": true})).into_response(),
        Err(e) => db_err(e).into_response(),
    }
}

// ═══════════════════════════════════════════════════════════════
//  CLOSE THERAPY
// ═══════════════════════════════════════════════════════════════

/// POST /api/therapies/{id}/close
pub async fn close_therapy(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(therapy_id): Path<i64>,
) -> impl IntoResponse {
    let session = match get_claims(&headers, &state).await {
        Some(s) => s,
        None => return unauthorized().into_response(),
    };
    if session.role != "admin" && session.role != "operator" {
        return forbidden().into_response();
    }

    match state.db.close_therapy(therapy_id).await {
        Ok(_) => {
            state.serial_manager.request_therapy_close(therapy_id).await;
            Json(serde_json::json!({"ok": true})).into_response()
        }
        Err(e) => db_err(e).into_response(),
    }
}

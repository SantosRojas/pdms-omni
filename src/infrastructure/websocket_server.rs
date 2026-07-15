use std::net::SocketAddr;
use std::path::PathBuf;

use axum::body::Body;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Router;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::http::header;
use axum::routing::{delete, get, post, put};
use serde::Serialize;
use tokio::sync::broadcast;
use tower::service_fn;
use tower_http::cors::{AllowOrigin, Any, CorsLayer};
use tracing::{error, info};

use super::auth::decode_token;
use super::db_pool::DbPool;
use super::http_api::{self, ApiState};

async fn api_not_found() -> axum::response::Response {
    (
        axum::http::StatusCode::NOT_FOUND,
        axum::Json(serde_json::json!({"error": "API endpoint not found"})),
    )
        .into_response()
}

#[derive(Clone)]
pub struct WebSocketHub {
    tx: broadcast::Sender<String>,
}

impl WebSocketHub {
    #[allow(clippy::too_many_arguments)]
    pub fn start(
        addr: SocketAddr,
        db: Option<DbPool>,
        persistence_enabled: bool,
        jwt_secret: String,
        jwt_token_ttl_secs: u64,
        serial_manager: std::sync::Arc<super::serial_manager::SerialReaderManager>,
        dashboard_dir: Option<PathBuf>,
        cors_origins: Vec<String>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let (tx, _) = broadcast::channel::<String>(512);
        let app_tx = tx.clone();

        tokio::spawn(async move {
            let cors = if cors_origins.iter().any(|o| o == "*") {
                CorsLayer::new()
                    .allow_origin(Any)
                    .allow_methods(Any)
                    .allow_headers(Any)
            } else {
                let origins: Vec<_> = cors_origins
                    .iter()
                    .filter_map(|o| o.parse::<axum::http::HeaderValue>().ok())
                    .collect();
                CorsLayer::new()
                    .allow_origin(AllowOrigin::list(origins))
                    .allow_methods(Any)
                    .allow_headers(Any)
            };

            let ws_jwt_secret = jwt_secret.clone();
            let ws_route = move |ws: WebSocketUpgrade| {
                let tx = app_tx.clone();
                let secret = ws_jwt_secret.clone();
                async move { ws.on_upgrade(move |socket| handle_socket(socket, tx.subscribe(), secret)) }
            };

            // Build a 503-returning fallback for all API routes when the DB is unavailable.
            fn db_unavailable() -> impl axum::response::IntoResponse {
                (
                    axum::http::StatusCode::SERVICE_UNAVAILABLE,
                    axum::Json(serde_json::json!({
                        "error": "Base de datos no disponible. El historial y la autenticación están deshabilitados.",
                        "persistence_enabled": false
                    })),
                )
            }

            // Build shared API state (only when DB is available)
            let api_state: Option<ApiState> = db.map(|db| ApiState {
                db,
                jwt_secret,
                jwt_token_ttl_secs,
                serial_manager,
            });

            // Build a nested /api router with its own fallback for unknown API routes
            // (returns JSON 404 instead of falling through to the SPA).
            let api_router: Router<()> = if let Some(ref state) = api_state {
                Router::new()
                    .route(
                        "/status",
                        get({
                            let persistence_enabled = persistence_enabled;
                            move || async move {
                                axum::Json(serde_json::json!({
                                    "ok": true,
                                    "persistence_enabled": persistence_enabled
                                }))
                            }
                        }),
                    )
                    // Auth
                    .route("/auth/login", post(http_api::login))
                    .route("/auth/login-with-token", post(http_api::login_with_token))
                    .route("/auth/callback", get(http_api::auth_callback))
                    .route("/auth/logout", post(http_api::logout))
                    .route("/auth/me", get(http_api::get_me))
                    // Users CRUD
                    .route("/users", get(http_api::list_users))
                    .route("/users", post(http_api::create_user))
                    .route("/users/{id}", put(http_api::update_user))
                    .route("/users/{id}", delete(http_api::delete_user))
                    // Equivalences CRUD
                    .route("/equivalences", get(http_api::list_equivalences))
                    .route("/equivalences", post(http_api::create_equivalence))
                    .route("/equivalences", put(http_api::update_equivalence))
                    .route("/equivalences", delete(http_api::delete_equivalence))
                    // Signals config
                    .route("/signals", get(http_api::list_signals))
                    .route("/signals/{id}", put(http_api::update_signal))
                    // Telemetry
                    .route("/patients", get(http_api::list_patients))
                    .route("/therapies", get(http_api::list_therapies))
                    .route("/history", get(http_api::patient_history))
                    .route("/export", get(http_api::export_csv))
                    .route("/therapy-history", get(http_api::therapy_history))
                    .route("/therapy-export", get(http_api::export_therapy_csv))
                    // Serial Reader Control
                    .route("/serial/status", get(http_api::serial_status))
                    .route("/serial/start", post(http_api::serial_start))
                    .route("/serial/stop", post(http_api::serial_stop))
                    // Session Readings
                    .route(
                        "/sessions/{id}/readings",
                        get(http_api::get_session_readings),
                    )
                    // Therapy Comments
                    .route("/therapies/{id}/comments", get(http_api::list_comments))
                    .route("/therapies/{id}/comments", post(http_api::create_comment))
                    .route(
                        "/therapies/comments/{comment_id}",
                        delete(http_api::delete_comment),
                    )
                    .route("/therapies/{id}/close", post(http_api::close_therapy))
                    .with_state(state.clone())
                    .fallback(api_not_found)
            } else {
                // DB not available: all API routes return 503.
                Router::new()
                    .route(
                        "/status",
                        get({
                            let persistence_enabled = persistence_enabled;
                            move || async move {
                                axum::Json(serde_json::json!({
                                    "ok": true,
                                    "persistence_enabled": persistence_enabled,
                                    "message": "Base de datos no disponible"
                                }))
                            }
                        }),
                    )
                    .route("/auth/login", post(|| async { db_unavailable() }))
                    .route(
                        "/auth/login-with-token",
                        post(|| async { db_unavailable() }),
                    )
                    .route("/auth/callback", get(|| async { db_unavailable() }))
                    .route("/auth/logout", post(|| async { db_unavailable() }))
                    .route("/auth/me", get(|| async { db_unavailable() }))
                    .route("/users", get(|| async { db_unavailable() }))
                    .route("/users", post(|| async { db_unavailable() }))
                    .route("/users/{id}", put(|| async { db_unavailable() }))
                    .route("/users/{id}", delete(|| async { db_unavailable() }))
                    .route("/equivalences", get(|| async { db_unavailable() }))
                    .route("/equivalences", post(|| async { db_unavailable() }))
                    .route("/equivalences", put(|| async { db_unavailable() }))
                    .route("/equivalences", delete(|| async { db_unavailable() }))
                    .route("/signals", get(|| async { db_unavailable() }))
                    .route("/signals/{id}", put(|| async { db_unavailable() }))
                    .route("/patients", get(|| async { db_unavailable() }))
                    .route("/therapies", get(|| async { db_unavailable() }))
                    .route("/history", get(|| async { db_unavailable() }))
                    .route("/export", get(|| async { db_unavailable() }))
                    .route("/therapy-history", get(|| async { db_unavailable() }))
                    .route("/therapy-export", get(|| async { db_unavailable() }))
                    .route("/serial/status", get(|| async { db_unavailable() }))
                    .route("/serial/start", post(|| async { db_unavailable() }))
                    .route("/serial/stop", post(|| async { db_unavailable() }))
                    .route(
                        "/therapies/{id}/comments",
                        get(|| async { db_unavailable() }),
                    )
                    .route(
                        "/therapies/{id}/comments",
                        post(|| async { db_unavailable() }),
                    )
                    .route(
                        "/therapies/comments/{comment_id}",
                        delete(|| async { db_unavailable() }),
                    )
                    .route("/therapies/{id}/close", post(|| async { db_unavailable() }))
                    .route(
                        "/sessions/{id}/readings",
                        get(|| async { db_unavailable() }),
                    )
                    .fallback(api_not_found)
            };

            let mut app = Router::new()
                .nest("/api", api_router)
                .route("/ws", get(ws_route))
                .layer(cors);

            // Apply token_permanente middleware when DB is available
            if let Some(ref state) = api_state {
                app = app.layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    http_api::token_permanente_middleware,
                ));
            }

            if let Some(ref dir) = dashboard_dir {
                info!("[WS] Sirviendo dashboard desde {}", dir.display());
            }
            app = app.fallback_service(dashboard_fallback(dashboard_dir));

            let listener = match tokio::net::TcpListener::bind(addr).await {
                Ok(l) => l,
                Err(e) => {
                    error!("[WS] Failed to open {}: {}", addr, e);
                    return;
                }
            };
            info!("[WS] Servidor WS + API activo en http://{}", addr);

            if let Err(e) = axum::serve(listener, app).await {
                error!("[WS] Error en servidor: {}", e);
            }
        });

        Ok(Self { tx })
    }

    pub fn broadcast_json<T: Serialize>(&self, payload: &T) -> Result<(), serde_json::Error> {
        let msg = serde_json::to_string(payload)?;
        let _ = self.tx.send(msg);
        Ok(())
    }
}

/// Returns a static-file-guessing MIME type for common extensions.
fn mime_type(path: &std::path::Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()).unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "js" | "mjs" => "application/javascript; charset=utf-8",
        "json" => "application/json",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" | "svgz" => "image/svg+xml",
        "ico" => "image/x-icon",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" | "otf" => "font/ttf",
        "eot" => "application/vnd.ms-fontobject",
        "wasm" => "application/wasm",
        "map" => "application/json",
        _ => "application/octet-stream",
    }
}

/// Serves the built dashboard as an SPA.
///
/// Actual static files (JS, CSS, images, fonts) are served from disk.
/// All other paths (SPA routes like `/therapy/85`) receive `index.html`
/// with HTTP 200 so that client-side routing works after a page reload.
fn dashboard_fallback(dir: Option<PathBuf>) -> Router<()> {
    if let Some(dir) = dir {
        let svc = service_fn(move |req: axum::http::Request<Body>| {
            let dir = dir.clone();
            async move {
                let path = req.uri().path().trim_start_matches('/');
                let full_path = dir.join(path);
                let index_path = dir.join("index.html");

                if full_path.is_file() {
                    match std::fs::read(&full_path) {
                        Ok(data) => Ok(
                            (StatusCode::OK, [(header::CONTENT_TYPE, mime_type(&full_path))], data)
                                .into_response(),
                        ),
                        Err(_) => Ok((StatusCode::NOT_FOUND, "Not found").into_response()),
                    }
                } else {
                    match std::fs::read_to_string(&index_path) {
                        Ok(html) => Ok((
                            StatusCode::OK,
                            [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
                            html,
                        )
                            .into_response()),
                        Err(e) => {
                            tracing::error!("[Dashboard] Failed to read index.html: {}", e);
                            Ok((StatusCode::NOT_FOUND, "Not found").into_response())
                        }
                    }
                }
            }
        });

        Router::new().fallback_service(svc)
    } else {
        Router::new().fallback(|| async {
            (
                StatusCode::NOT_FOUND,
                "Not found. The API is running; serve the dashboard separately or set DASHBOARD_DIR.",
            )
        })
    }
}

async fn handle_socket(
    mut socket: WebSocket,
    mut rx: broadcast::Receiver<String>,
    jwt_secret: String,
) {
    // ── Require auth token as first message ──────────────────────
    let is_authenticated =
        match tokio::time::timeout(std::time::Duration::from_secs(10), socket.recv()).await {
            Ok(Some(Ok(Message::Text(text)))) => {
                match serde_json::from_str::<serde_json::Value>(&text) {
                    Ok(val) if val.get("type").and_then(|t| t.as_str()) == Some("auth") => {
                        let token = val.get("token").and_then(|t| t.as_str()).unwrap_or("");
                        match decode_token(&jwt_secret, token) {
                            Ok(_) => {
                                let _ = socket
                                    .send(Message::Text(r#"{"type":"auth_ok"}"#.into()))
                                    .await;
                                true
                            }
                            Err(_) => {
                                let _ = socket
                                    .send(Message::Text(
                                        r#"{"type":"auth_error","error":"invalid_token"}"#.into(),
                                    ))
                                    .await;
                                false
                            }
                        }
                    }
                    _ => {
                        let _ = socket
                            .send(Message::Text(
                                r#"{"type":"auth_error","error":"expected_auth"}"#.into(),
                            ))
                            .await;
                        false
                    }
                }
            }
            _ => false,
        };

    if !is_authenticated {
        let _ = socket.send(Message::Close(None)).await;
        return;
    }

    // ── Normal message loop ──────────────────────────────────────
    loop {
        tokio::select! {
            outbound = rx.recv() => {
                match outbound {
                    Ok(text) => {
                        if socket.send(Message::Text(text.into())).await.is_err() {
                            break;
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(_)) => {
                        tracing::warn!("[WS] Cliente perdió mensajes (broadcast lag)");
                        continue;
                    }
                    Err(broadcast::error::RecvError::Closed) => break,
                }
            }
            inbound = socket.recv() => {
                match inbound {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(Message::Ping(payload))) => {
                        if socket.send(Message::Pong(payload)).await.is_err() {
                            break;
                        }
                    }
                    Some(Ok(_)) => {}
                    Some(Err(_)) => break,
                }
            }
        }
    }
}

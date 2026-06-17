use std::net::SocketAddr;
use std::path::PathBuf;

use axum::Router;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::response::IntoResponse;
use axum::routing::{delete, get, post, put};
use serde::Serialize;
use tokio::sync::broadcast;
use tower_http::cors::{AllowOrigin, Any, CorsLayer};
use tower_http::services::ServeDir;
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

            // Build a nested /api router with its own fallback for unknown API routes
            // (returns JSON 404 instead of falling through to the SPA).
            let api_router: Router<()> = if let Some(db) = db {
                let api_state = ApiState {
                    db,
                    jwt_secret,
                    jwt_token_ttl_secs,
                    serial_manager,
                };

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
                    .with_state(api_state)
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

            let app = Router::new()
                .nest("/api", api_router)
                .route("/ws", get(ws_route))
                .layer(cors)
                .fallback_service(dashboard_fallback(dashboard_dir.as_deref()));

            let listener = match tokio::net::TcpListener::bind(addr).await {
                Ok(l) => l,
                Err(e) => {
                    error!("[WS] Failed to open {}: {}", addr, e);
                    return;
                }
            };

            if let Some(ref dir) = dashboard_dir {
                info!("[WS] Sirviendo dashboard desde {}", dir.display());
            }
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

/// Creates a fallback router that serves the built dashboard (SPA).
fn dashboard_fallback(dir: Option<&std::path::Path>) -> Router {
    if let Some(dir) = dir {
        Router::new().fallback_service(ServeDir::new(dir).append_index_html_on_directories(true))
    } else {
        Router::new().fallback(|| async {
            (
                axum::http::StatusCode::NOT_FOUND,
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

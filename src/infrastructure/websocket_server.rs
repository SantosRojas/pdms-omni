use std::net::SocketAddr;
use std::path::PathBuf;

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::routing::{get, post, put, delete};
use axum::Router;
use serde::Serialize;
use tokio::sync::broadcast;
use tower_http::cors::{CorsLayer, Any};
use tower_http::services::ServeDir;

use super::db_pool::DbPool;
use super::http_api::{self, ApiState};

#[derive(Clone)]
pub struct WebSocketHub {
    tx: broadcast::Sender<String>,
}

impl WebSocketHub {
    pub fn start(
        addr: SocketAddr,
        db: Option<DbPool>,
        persistence_enabled: bool,
        jwt_secret: String,
        jwt_token_ttl_secs: u64,
        serial_manager: std::sync::Arc<super::serial_manager::SerialReaderManager>,
        dashboard_dir: Option<PathBuf>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let (tx, _) = broadcast::channel::<String>(512);
        let app_tx = tx.clone();

        tokio::spawn(async move {
            let cors = CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any);

            let ws_route = move |ws: WebSocketUpgrade| {
                let tx = app_tx.clone();
                async move { ws.on_upgrade(move |socket| handle_socket(socket, tx.subscribe())) }
            };

            // Build a 503-returning fallback for all API routes when the DB is unavailable.
            // This ensures the frontend always gets a meaningful response instead of a 404/connection error.
            fn db_unavailable() -> impl axum::response::IntoResponse {
                (
                    axum::http::StatusCode::SERVICE_UNAVAILABLE,
                    axum::Json(serde_json::json!({
                        "error": "Base de datos no disponible. El historial y la autenticación están deshabilitados.",
                        "persistence_enabled": false
                    })),
                )
            }

            let app = if let Some(db) = db {
                let api_state = ApiState {
                    db,
                    jwt_secret,
                    jwt_token_ttl_secs,
                    serial_manager,
                };

                Router::new()
                    .route("/ws", get(ws_route))
                    .route("/api/status", get({
                        let persistence_enabled = persistence_enabled;
                        move || async move {
                            axum::Json(serde_json::json!({
                                "ok": true,
                                "persistence_enabled": persistence_enabled
                            }))
                        }
                    }))
                    // Auth
                    .route("/api/auth/login", post(http_api::login))
                    .route("/api/auth/logout", post(http_api::logout))
                    .route("/api/auth/me", get(http_api::get_me))
                    // Users CRUD
                    .route("/api/users", get(http_api::list_users))
                    .route("/api/users", post(http_api::create_user))
                    .route("/api/users/{id}", put(http_api::update_user))
                    .route("/api/users/{id}", delete(http_api::delete_user))
                    // Equivalences CRUD
                    .route("/api/equivalences", get(http_api::list_equivalences))
                    .route("/api/equivalences", post(http_api::create_equivalence))
                    .route("/api/equivalences", delete(http_api::delete_equivalence))
                    // Telemetry
                    .route("/api/patients", get(http_api::list_patients))
                    .route("/api/therapies", get(http_api::list_therapies))
                    .route("/api/history", get(http_api::patient_history))
                    .route("/api/export", get(http_api::export_csv))
                    .route("/api/therapy-history", get(http_api::therapy_history))
                    .route("/api/therapy-export", get(http_api::export_therapy_csv))
                    // Serial Reader Control
                    .route("/api/serial/status", get(http_api::serial_status))
                    .route("/api/serial/start", post(http_api::serial_start))
                    .route("/api/serial/stop", post(http_api::serial_stop))
                    // Therapy Comments
                    .route("/api/therapies/{id}/comments", get(http_api::list_comments))
                    .route("/api/therapies/{id}/comments", post(http_api::create_comment))
                    .route("/api/therapies/comments/{comment_id}", delete(http_api::delete_comment))
                    .with_state(api_state)
                    .layer(cors)
                    .fallback_service(dashboard_fallback(dashboard_dir.as_deref()))
            } else {
                // DB not available: register all API routes but respond with 503 so the
                // frontend knows the service is degraded (not a network error or 404).
                Router::new()
                    .route("/ws", get(ws_route))
                    .route("/api/status", get({
                        let persistence_enabled = persistence_enabled;
                        move || async move {
                            axum::Json(serde_json::json!({
                                "ok": true,
                                "persistence_enabled": persistence_enabled,
                                "message": "Base de datos no disponible"
                            }))
                        }
                    }))
                    .route("/api/auth/login",   post(|| async { db_unavailable() }))
                    .route("/api/auth/logout",  post(|| async { db_unavailable() }))
                    .route("/api/auth/me",       get(|| async { db_unavailable() }))
                    .route("/api/users",         get(|| async { db_unavailable() }))
                    .route("/api/users",        post(|| async { db_unavailable() }))
                    .route("/api/users/{id}",    put(|| async { db_unavailable() }))
                    .route("/api/users/{id}", delete(|| async { db_unavailable() }))
                    .route("/api/equivalences",   get(|| async { db_unavailable() }))
                    .route("/api/equivalences",  post(|| async { db_unavailable() }))
                    .route("/api/equivalences", delete(|| async { db_unavailable() }))
                    .route("/api/patients",       get(|| async { db_unavailable() }))
                    .route("/api/therapies",      get(|| async { db_unavailable() }))
                    .route("/api/history",        get(|| async { db_unavailable() }))
                    .route("/api/export",         get(|| async { db_unavailable() }))
                    .route("/api/therapy-history",get(|| async { db_unavailable() }))
                    .route("/api/therapy-export", get(|| async { db_unavailable() }))
                    .route("/api/serial/status",  get(|| async { db_unavailable() }))
                    .route("/api/serial/start",  post(|| async { db_unavailable() }))
                    .route("/api/serial/stop",   post(|| async { db_unavailable() }))
                    .route("/api/therapies/{id}/comments",              get(|| async { db_unavailable() }))
                    .route("/api/therapies/{id}/comments",             post(|| async { db_unavailable() }))
                    .route("/api/therapies/comments/{comment_id}",     delete(|| async { db_unavailable() }))
                    .layer(cors)
                    .fallback_service(dashboard_fallback(dashboard_dir.as_deref()))
            };

            let listener = match tokio::net::TcpListener::bind(addr).await {
                Ok(l) => l,
                Err(e) => {
                    eprintln!("[WS] No se pudo abrir {}: {}", addr, e);
                    return;
                }
            };

            if let Some(ref dir) = dashboard_dir {
                println!("[WS] Sirviendo dashboard desde {}", dir.display());
            }
            println!("[WS] Servidor WS + API activo en http://{}", addr);

            if let Err(e) = axum::serve(listener, app).await {
                eprintln!("[WS] Error en servidor: {}", e);
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
/// If `dashboard_dir` is `None`, returns a simple 404 handler.
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

async fn handle_socket(mut socket: WebSocket, mut rx: broadcast::Receiver<String>) {
    loop {
        tokio::select! {
            outbound = rx.recv() => {
                match outbound {
                    Ok(text) => {
                        if socket.send(Message::Text(text.into())).await.is_err() {
                            break;
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(_)) => continue,
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

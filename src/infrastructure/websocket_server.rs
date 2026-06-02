use std::net::SocketAddr;

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::routing::{get, post, put, delete};
use axum::Router;
use serde::Serialize;
use tokio::sync::broadcast;
use tower_http::cors::{CorsLayer, Any};

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

            let app = if let Some(db) = db {
                let api_state = ApiState {
                    db,
                    jwt_secret,
                    jwt_token_ttl_secs,
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
                    .with_state(api_state)
                    .layer(cors)
            } else {
                Router::new()
                    .route("/ws", get(ws_route))
                    .route("/api/status", get({
                        let persistence_enabled = persistence_enabled;
                        move || async move {
                            axum::Json(serde_json::json!({
                                "ok": true,
                                "persistence_enabled": persistence_enabled,
                                "message": "API de persistencia deshabilitada: base de datos no disponible"
                            }))
                        }
                    }))
                    .layer(cors)
            };

            let listener = match tokio::net::TcpListener::bind(addr).await {
                Ok(l) => l,
                Err(e) => {
                    eprintln!("[WS] No se pudo abrir {}: {}", addr, e);
                    return;
                }
            };

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

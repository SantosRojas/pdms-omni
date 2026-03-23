use std::net::SocketAddr;
use std::thread;

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::routing::get;
use axum::Router;
use serde::Serialize;
use tokio::sync::broadcast;

#[derive(Clone)]
pub struct WebSocketHub {
    tx: broadcast::Sender<String>,
}

impl WebSocketHub {
    pub fn start(addr: SocketAddr) -> Result<Self, Box<dyn std::error::Error>> {
        let (tx, _) = broadcast::channel::<String>(512);
        let app_tx = tx.clone();

        thread::spawn(move || {
            let runtime = match tokio::runtime::Builder::new_multi_thread()
                .enable_all()
                .build()
            {
                Ok(rt) => rt,
                Err(e) => {
                    eprintln!("[WS] No se pudo crear runtime: {}", e);
                    return;
                }
            };

            runtime.block_on(async move {
                let app = Router::new().route(
                    "/ws",
                    get(move |ws: WebSocketUpgrade| {
                        let tx = app_tx.clone();
                        async move { ws.on_upgrade(move |socket| handle_socket(socket, tx.subscribe())) }
                    }),
                );

                let listener = match tokio::net::TcpListener::bind(addr).await {
                    Ok(l) => l,
                    Err(e) => {
                        eprintln!("[WS] No se pudo abrir {}: {}", addr, e);
                        return;
                    }
                };

                println!("[WS] Servidor websocket activo en ws://{}/ws", addr);

                if let Err(e) = axum::serve(listener, app).await {
                    eprintln!("[WS] Error en servidor websocket: {}", e);
                }
            });
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
                    Err(broadcast::error::RecvError::Lagged(_)) => {
                        continue;
                    }
                    Err(broadcast::error::RecvError::Closed) => {
                        break;
                    }
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

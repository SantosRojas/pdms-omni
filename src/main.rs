//! PDMS-Omni: B.Braun OMNI-ODI Patient Data Management System client.
//! Built with Clean Architecture — all infrastructure is swappable.

mod application;
mod domain;
mod infrastructure;

use std::time::Duration;

use serde::Serialize;

use crate::application::use_cases::OmniInteractor;
use crate::domain::entities::TelemetryReading;
use crate::infrastructure::config::{AppConfig, CaptureMode};
use crate::infrastructure::database;
use crate::infrastructure::serial_communicator::{SerialConfig, SerialDeviceCommunicator};
use crate::infrastructure::websocket_server::WebSocketHub;

#[derive(Serialize)]
struct TelemetryEvent<'a> {
    #[serde(rename = "type")]
    event_type: &'static str,
    cycle: u64,
    readings: &'a [TelemetryReading],
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("╔══════════════════════════════════════════════╗");
    println!("║   PDMS-Omni · B.Braun OMNI-ODI Client        ║");
    println!("╚══════════════════════════════════════════════╝\n");

    // 1. Configuración
    let config = AppConfig::from_env();
    println!(
        "[Config] DB={}, Puerto={}, Baudrate={}, WS=ws://{}:{}/ws",
        config.db_path, config.port_name, config.baudrate, config.ws_host, config.ws_port
    );
    match config.capture_mode {
        CaptureMode::All => println!("[Config] Captura de parametros: ALL"),
        CaptureMode::Selected => println!(
            "[Config] Captura de parametros: SELECTED (handles={}, names={})",
            config.capture_handles.len(),
            config.capture_names.len()
        ),
    }

    if matches!(config.capture_mode, CaptureMode::Selected)
        && config.capture_handles.is_empty()
        && config.capture_names.is_empty()
    {
        eprintln!("[Config] CAPTURE_MODE=selected sin filtros definidos. Se capturara ALL.");
    }

    let ws_addr = format!("{}:{}", config.ws_host, config.ws_port).parse()?;
    let ws_hub = WebSocketHub::start(ws_addr)?;

    // 2. Base de datos (intercambiable)
    let repos = database::initialize_sqlite(&config.db_path)?;
    println!("[DB] Conectada: {}", config.db_path);

    // 3. Dispositivo serial (intercambiable)
    let serial_config = SerialConfig {
        port_name: config.port_name.clone(),
        baudrate: config.baudrate,
        src_addr: config.src_addr,
        dst_addr: config.dst_addr,
    };
    let device = SerialDeviceCommunicator::new(serial_config)?;
    println!(
        "[Serial] Puerto {} abierto (19200, 8N1)\n",
        config.port_name
    );

    // 4. Inyección de dependencias → Caso de uso
    let mut interactor = OmniInteractor::new(
        repos.attr_repo,
        repos.dict_repo,
        repos.telemetry_repo,
        repos.version_repo,
        device,
    );

    // 5. Inicialización del protocolo OMNI-ODI
    let version = interactor.initialize()?;
    println!("[OK] OMNI inicializado: System SW={}", version.system_sw);

    // 6. Fase cíclica: lectura de valores cada segundo
    println!("\n[Loop] Lectura cíclica de valores (Ctrl+C para detener)...\n");
    let mut cycle: u64 = 0;

    loop {
        cycle += 1;
        let capture_all = matches!(config.capture_mode, CaptureMode::All)
            || (config.capture_handles.is_empty() && config.capture_names.is_empty());

        let cycle_result = if capture_all {
            interactor.get_cyclical_values()
        } else {
            interactor.get_cyclical_values_filtered(|attr| {
                config.capture_handles.contains(&attr.handle)
                    || config
                        .capture_names
                        .contains(&attr.internal_name.to_ascii_lowercase())
            })
        };

        match cycle_result {
            Ok(readings) => {
                println!("── Ciclo {} ── {} lecturas ──", cycle, readings.len());
                for r in &readings {
                    println!(
                        "  {:30} = {:>10.2} {}",
                        r.internal_name, r.physical_value, r.unit
                    );
                }

                let event = TelemetryEvent {
                    event_type: "telemetry",
                    cycle,
                    readings: &readings,
                };
                if let Err(e) = ws_hub.broadcast_json(&event) {
                    eprintln!("[WS] No se pudo serializar/broadcast de ciclo {}: {}", cycle, e);
                }
            }
            Err(e) => {
                eprintln!("[ERROR] Ciclo {}: {}", cycle, e);
            }
        }
        std::thread::sleep(Duration::from_secs(1));
    }
}

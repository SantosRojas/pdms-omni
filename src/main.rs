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
    therapy_active: bool,
    therapy_state_name: String,
    therapy_start: Option<String>,
    therapy_end: Option<String>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("╔══════════════════════════════════════════════╗");
    println!("║   PDMS-Omni · B.Braun OMNI-ODI Client        ║");
    println!("╚══════════════════════════════════════════════╝\n");

    // 1. Configuración
    let config = AppConfig::from_env();
    println!(
        "[Config] DB={}, Puerto={}, Baudrate={}, Timeout={}s, WS=ws://{}:{}/ws",
        config.get_database_url(),
        config.port_name,
        config.baudrate,
        config.serial_timeout_secs,
        config.ws_host,
        config.ws_port
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

    // 2. Base de datos (intercambiable)
    let db_url = config.get_database_url();
    let repos = database::initialize_db(&db_url).await?;
    println!("[DB] Conectada: {}", db_url);

    // 3. WebSocket + HTTP API server (shares DB connection)
    let ws_hub = WebSocketHub::start(ws_addr, repos.db.clone())?;

    // 3. Dispositivo serial (intercambiable)
    let serial_config = SerialConfig {
        port_name: config.port_name.clone(),
        baudrate: config.baudrate,
        timeout_secs: config.serial_timeout_secs,
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
        repos.equiv_repo,
        device,
    );

    // 5. Inicialización del protocolo OMNI-ODI
    let version = interactor.initialize().await?;
    println!("[OK] OMNI inicializado: System SW={}", version.system_sw);

    // 6. Fase cíclica: lectura de valores cada segundo
    // Separamos el tiempo de muestreo (WebSocket) del tiempo de guardado puntual (DB)
    let mut cycle: u64 = 0;
    let mut last_save = tokio::time::Instant::now();
    let save_interval = Duration::from_secs(config.db_save_interval_secs);
    let mut was_in_therapy = false;
    let mut therapy_start_time: Option<String> = None;
    let mut therapy_end_time: Option<String> = None;
    let mut current_patient_id: Option<i64> = None;

    println!("\n[Loop] Lectura cíclica de valores (Ctrl+C para detener)...\n");

    loop {
        cycle += 1;
        let capture_all = matches!(config.capture_mode, CaptureMode::All)
            || (config.capture_handles.is_empty() && config.capture_names.is_empty());

        let cycle_result = if capture_all {
            interactor.get_cyclical_values().await
        } else {
            interactor.get_cyclical_values_filtered(|attr| {
                let name_lc = attr.internal_name.to_ascii_lowercase();
                config.capture_handles.contains(&attr.handle)
                    || config.capture_names.contains(&name_lc)
                    // If we only save on therapy, we MUST capture the state variable
                    || (config.db_save_only_on_therapy && (name_lc == "c_trmt_main_state" || name_lc == "g_trmt_main_state_set"))
            }).await
        };

        match cycle_result {
            Ok(readings) => {
                println!("── Ciclo {} ── {} lecturas ──", cycle, readings.len());
                
                // Determine if we are in therapy mode (value 2.0 for c_trmt_main_state or g_trmt_main_state_set)
                let is_in_therapy = readings.iter().any(|r| {
                    (r.internal_name == "c_trmt_main_state" || r.internal_name == "g_trmt_main_state_set")
                    && matches!(&r.physical_value, crate::domain::entities::TelemetryValue::Number(n) if (n - 2.0).abs() < 0.1)
                });

                let therapy_state_name = readings.iter()
                    .find(|r| r.internal_name == "c_trmt_main_state" || r.internal_name == "g_trmt_main_state_set")
                    .and_then(|r| r.display_value.clone())
                    .unwrap_or_else(|| "N/A".to_string());

                println!("[Estado] Terapia activa: {}, Estado: {}", is_in_therapy, therapy_state_name);

                // Detect state transitions and patient changes
                let patient_id = readings.first().and_then(|r| r.patient_id);
                
                if patient_id != current_patient_id {
                    // Patient changed! Reset therapy state
                    current_patient_id = patient_id;
                    was_in_therapy = false;
                    therapy_start_time = None;
                    therapy_end_time = None;
                    println!("[EVENTO] Cambio de paciente detectado: {:?}", patient_id);
                }

                if let Some(pid) = patient_id {
                    if is_in_therapy && !was_in_therapy {
                        println!("[DB] Detectado INICIO de terapia!");
                        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
                        therapy_start_time = Some(now);
                        therapy_end_time = None;
                        let _ = interactor.start_therapy(pid).await;
                    } else if !is_in_therapy && was_in_therapy {
                        println!("[DB] Detectado FIN de terapia!");
                        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
                        therapy_end_time = Some(now);
                        let _ = interactor.end_therapy(pid).await;
                    }
                }
                was_in_therapy = is_in_therapy;

                for r in &readings {
                    use crate::domain::entities::TelemetryValue;
                    match &r.physical_value {
                        TelemetryValue::Number(n) => {
                            if let Some(display) = &r.display_value {
                                println!(
                                    "  {:30} = {:>10.2} {} ({})",
                                    r.internal_name, n, r.unit, display
                                );
                            } else {
                                println!(
                                    "  {:30} = {:>10.2} {}",
                                    r.internal_name, n, r.unit
                                );
                            }
                        }
                        TelemetryValue::String(s) => {
                            println!(
                                "  {:30} = {:>10} {}",
                                r.internal_name, s, r.unit
                            );
                        }
                    }
                }

                let event = TelemetryEvent {
                    event_type: "telemetry",
                    cycle,
                    readings: &readings,
                    therapy_active: is_in_therapy,
                    therapy_state_name: therapy_state_name.clone(),
                    therapy_start: therapy_start_time.clone(),
                    therapy_end: therapy_end_time.clone(),
                };
                if let Err(e) = ws_hub.broadcast_json(&event) {
                    eprintln!("[WS] No se pudo serializar/broadcast de ciclo {}: {}", cycle, e);
                }

                // Persist only every DB_SAVE_INTERVAL (Snapshots) AND only if we are in therapy if requested
                if last_save.elapsed() >= save_interval {
                    let should_save = !config.db_save_only_on_therapy || is_in_therapy;
                    
                    if should_save {
                        println!("[DB] Guardando snapshot de ciclo {} ({} lecturas)...", cycle, readings.len());
                        if let Err(e) = interactor.save_telemetry(&readings).await {
                            eprintln!("[DB] ERROR al persistir snapshot: {}", e);
                        } else {
                            last_save = tokio::time::Instant::now();
                        }
                    } else {
                        println!("[DB] Snapshot omitido (el paciente no está en terapia).");
                        last_save = tokio::time::Instant::now();
                    }
                }
            }
            Err(e) => {
                eprintln!("[ERROR] Ciclo {}: {}", cycle, e);
            }
        }
        tokio::time::sleep(Duration::from_secs(config.cycle_interval_secs)).await;
    }
}

//! PDMS-Omni: B.Braun OMNI-ODI Patient Data Management System client.
//! Built with Clean Architecture — all infrastructure is swappable.

mod application;
mod domain;
mod infrastructure;

use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;

use crate::application::use_cases::OmniInteractor;
use crate::domain::entities::TelemetryReading;
use crate::infrastructure::config::{AppConfig, CaptureMode};
use crate::infrastructure::database;
use crate::infrastructure::database::Repositories;
use crate::infrastructure::serial_communicator::{SerialConfig, SerialDeviceCommunicator};
use crate::infrastructure::serial_manager::{ReaderCommand, SerialReaderManager};
use crate::infrastructure::websocket_server::WebSocketHub;

// ─────────────────────────────────────────────────────────────────
//  WebSocket event payloads
// ─────────────────────────────────────────────────────────────────

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
    persistence_enabled: bool,
    persistence_status: &'static str,
}

#[derive(Serialize, Clone)]
struct SerialEvent {
    #[serde(rename = "type")]
    event_type: &'static str,
    status: String,
    consecutive_failures: u32,
    max_failures: u32,
}

// ─────────────────────────────────────────────────────────────────
//  Device initializer with fixed-interval retry
// ─────────────────────────────────────────────────────────────────

async fn initialize_device_with_retry<Dev>(
    interactor: &mut OmniInteractor<
        impl crate::domain::repositories::DataAttributeRepository,
        impl crate::domain::repositories::DictionaryRepository,
        impl crate::domain::repositories::TelemetryRepository,
        impl crate::domain::repositories::VersionRepository,
        impl crate::domain::repositories::AttributeEquivalenceRepository,
        Dev,
    >,
    max_attempts: u32,
    interval_secs: u64,
) -> Result<crate::domain::entities::VersionInfo, String>
where
    Dev: crate::domain::device::DeviceCommunicator,
{
    for attempt in 1..=max_attempts {
        match interactor.initialize().await {
            Ok(version) => return Ok(version),
            Err(e) => {
                eprintln!("[Device] Inicialización fallida (intento {}/{}): {}", attempt, max_attempts, e);
                if attempt < max_attempts {
                    eprintln!("[Device] Reintentando en {}s...", interval_secs);
                    tokio::time::sleep(Duration::from_secs(interval_secs)).await;
                }
            }
        }
    }
    Err(format!(
        "Device initialization failed after {} attempt(s)",
        max_attempts
    ))
}

// ─────────────────────────────────────────────────────────────────
//  Serial reader session (single-threaded runtime, no Send needed)
// ─────────────────────────────────────────────────────────────────

/// Runs ONE complete serial reader session inside its own current-thread Tokio runtime.
/// This runs in a dedicated `std::thread`, bypassing the `Send` requirement for serial port.
///
/// The function blocks until the session ends (stopped by command or failure limit reached).
fn run_reader_session_blocking(
    config: Arc<AppConfig>,
    repos: Repositories,
    ws_hub: WebSocketHub,
    serial_manager: Arc<SerialReaderManager>,
    persistence_enabled: bool,
    new_therapy: bool,
) {
    // Build a single-threaded runtime so non-Send types (serial port) are fine
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("[Serial] No se pudo crear el runtime single-thread");

    rt.block_on(run_reader_session(
        &config,
        repos,
        &ws_hub,
        serial_manager,
        persistence_enabled,
        new_therapy,
    ));
}

async fn broadcast_serial_status(ws_hub: &WebSocketHub, serial_manager: &SerialReaderManager) {
    let current = serial_manager.get_status().await;
    let event = SerialEvent {
        event_type: "serial_status",
        status: current.status.clone(),
        consecutive_failures: current.consecutive_failures,
        max_failures: current.max_failures,
    };
    let _ = ws_hub.broadcast_json(&event);
}

async fn run_reader_session(
    config: &AppConfig,
    repos: Repositories,
    ws_hub: &WebSocketHub,
    serial_manager: Arc<SerialReaderManager>,
    persistence_enabled: bool,
    new_therapy: bool,
) {
    // Open serial port
    let serial_config = SerialConfig {
        port_name: config.port_name.clone(),
        baudrate: config.baudrate,
        timeout_secs: config.serial_timeout_secs,
        src_addr: config.src_addr,
        dst_addr: config.dst_addr,
    };

    let device = match SerialDeviceCommunicator::new(serial_config) {
        Ok(dev) => dev,
        Err(err) => {
            eprintln!("[Serial] No se pudo abrir el puerto: {}", err);
            serial_manager.record_failure().await;
            broadcast_serial_status(ws_hub, &serial_manager).await;
            return;
        }
    };

    println!("[Serial] Puerto {} abierto (19200, 8N1)\n", config.port_name);

    // Build interactor
    let mut interactor = OmniInteractor::new(
        repos.attr_repo.clone(),
        repos.dict_repo.clone(),
        repos.telemetry_repo.clone(),
        repos.version_repo.clone(),
        repos.equiv_repo.clone(),
        device,
    );

    // Initialize device with fixed-interval retry
    let version = match initialize_device_with_retry(
        &mut interactor,
        config.device_init_retry_max_attempts,
        config.device_init_retry_interval_secs,
    )
    .await
    {
        Ok(v) => {
            serial_manager.record_success().await;
            v
        }
        Err(e) => {
            eprintln!("[Device] {}", e);
            serial_manager.record_failure().await;
            broadcast_serial_status(ws_hub, &serial_manager).await;
            return;
        }
    };

    println!("[OK] OMNI inicializado: System SW={}", version.system_sw);
    serial_manager.set_running().await;
    broadcast_serial_status(ws_hub, &serial_manager).await;

    // Cyclic reading loop
    let mut cycle: u64 = 0;
    let mut last_save = tokio::time::Instant::now();
    let save_interval = Duration::from_secs(config.db_save_interval_secs);
    let mut was_in_therapy = false;
    let mut therapy_start_time: Option<String> = None;
    let mut therapy_end_time: Option<String> = None;
    let mut current_patient_key: Option<String> = None;
    let mut current_serial_number: Option<String> = None;
    let mut current_machine_id: Option<i64> = None;
    let mut current_therapy_id: Option<i64> = None;
    let mut persistence_warned = false;
    let mut force_new_session = new_therapy;
    let software_version = version.system_sw.clone();

    println!("\n[Loop] Lectura cíclica de valores (Ctrl+C para detener)...\n");

    loop {
        // Check if we should stop
        {
            let status = serial_manager.get_status().await;
            if status.status == "Stopped" || status.status == "FailedLimit" {
                println!("[Serial] Deteniendo lectura: {}", status.status);
                return;
            }
        }

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
                    || name_lc == "g_patient_id_str"
                    || name_lc == "d_serial_number_to_odi"
                    || (config.db_save_only_on_therapy
                        && (name_lc == "c_trmt_main_state"
                            || name_lc == "g_trmt_main_state_set"))
            }).await
        };

        match cycle_result {
            Ok(readings) => {
                serial_manager.record_success().await;

                println!("── Ciclo {} ── {} lecturas ──", cycle, readings.len());

                let is_in_therapy = readings.iter().any(|r| {
                    (r.internal_name == "c_trmt_main_state"
                        || r.internal_name == "g_trmt_main_state_set")
                        && matches!(&r.physical_value, crate::domain::entities::TelemetryValue::Number(n) if (n - 2.0).abs() < 0.1)
                });

                let therapy_state_name = readings
                    .iter()
                    .find(|r| {
                        r.internal_name == "c_trmt_main_state"
                            || r.internal_name == "g_trmt_main_state_set"
                    })
                    .and_then(|r| r.display_value.clone())
                    .unwrap_or_else(|| "N/A".to_string());

                println!(
                    "[Estado] Terapia activa: {}, Estado: {}",
                    is_in_therapy, therapy_state_name
                );

                let patient_key = readings
                    .iter()
                    .find(|r| r.internal_name == "g_patient_id_str")
                    .map(|r| match (&r.display_value, &r.physical_value) {
                        (Some(display), _) => display.clone(),
                        (None, crate::domain::entities::TelemetryValue::String(value)) => {
                            value.clone()
                        }
                        (None, crate::domain::entities::TelemetryValue::Number(value)) => {
                            value.to_string()
                        }
                    })
                    .filter(|v| !v.trim().is_empty());

                let serial_number = readings
                    .iter()
                    .find(|r| r.internal_name == "d_serial_number_to_odi")
                    .map(|r| match (&r.display_value, &r.physical_value) {
                        (Some(display), _) => display.clone(),
                        (None, crate::domain::entities::TelemetryValue::String(value)) => {
                            value.clone()
                        }
                        (None, crate::domain::entities::TelemetryValue::Number(value)) => {
                            value.to_string()
                        }
                    })
                    .filter(|v| !v.trim().is_empty());

                if patient_key != current_patient_key {
                    current_patient_key = patient_key.clone();
                    current_therapy_id = None;
                    was_in_therapy = false;
                    therapy_start_time = None;
                    therapy_end_time = None;
                    println!("[EVENTO] Cambio de paciente detectado: {:?}", current_patient_key);
                }

                if serial_number != current_serial_number {
                    current_serial_number = serial_number.clone();
                    current_machine_id = None;
                    current_therapy_id = None;
                    println!("[EVENTO] Cambio de máquina detectado: {:?}", current_serial_number);
                }

                if is_in_therapy {
                    if current_machine_id.is_none() {
                        if let Some(serial) = current_serial_number.as_deref() {
                            if persistence_enabled {
                                match interactor.get_or_create_machine(serial, &software_version).await {
                                    Ok(machine_id) => current_machine_id = Some(machine_id),
                                    Err(e) => eprintln!("[DB] No se pudo registrar la máquina: {}", e),
                                }
                            }
                        }
                    }

                    if current_therapy_id.is_none() {
                        if let (Some(patient), Some(machine_id)) =
                            (current_patient_key.as_deref(), current_machine_id)
                        {
                            if persistence_enabled {
                                let now = chrono::Local::now()
                                    .format("%Y-%m-%d %H:%M:%S")
                                    .to_string();
                                match interactor.get_or_create_patient(patient).await {
                                    Ok(patient_id) => {
                                        match interactor.get_or_create_therapy(patient_id, machine_id, &now, force_new_session).await {
                                            Ok(therapy_id) => {
                                                current_therapy_id = Some(therapy_id);
                                                therapy_start_time = Some(now);
                                                therapy_end_time = None;
                                                force_new_session = false;
                                            }
                                            Err(e) => eprintln!("[DB] No se pudo abrir la terapia: {}", e),
                                        }
                                    }
                                    Err(e) => eprintln!("[DB] No se pudo registrar el paciente: {}", e),
                                }
                            }
                        }
                    }

                    if !was_in_therapy && current_therapy_id.is_some() {
                        println!("[Therapy] Detectado INICIO de terapia!");
                    }
                } else if was_in_therapy {
                    println!("[Therapy] Detectado FIN de terapia!");
                    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
                    therapy_end_time = Some(now);
                    if persistence_enabled {
                        if let Some(therapy_id) = current_therapy_id {
                            let _ = interactor.end_therapy(therapy_id).await;
                        }
                    }
                    current_therapy_id = None;
                }
                was_in_therapy = is_in_therapy;

                for r in &readings {
                    use crate::domain::entities::TelemetryValue;
                    match &r.physical_value {
                        TelemetryValue::Number(n) => {
                            if let Some(display) = &r.display_value {
                                println!("  {:30} = {:>10.2} {} ({})", r.internal_name, n, r.unit, display);
                            } else {
                                println!("  {:30} = {:>10.2} {}", r.internal_name, n, r.unit);
                            }
                        }
                        TelemetryValue::String(s) => {
                            println!("  {:30} = {:>10} {}", r.internal_name, s, r.unit);
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
                    persistence_enabled,
                    persistence_status: if persistence_enabled { "persisting" } else { "not_persisting" },
                };
                if let Err(e) = ws_hub.broadcast_json(&event) {
                    eprintln!("[WS] No se pudo broadcast ciclo {}: {}", cycle, e);
                }

                if last_save.elapsed() >= save_interval {
                    if !persistence_enabled {
                        if !persistence_warned {
                            eprintln!("[Persistencia] DESHABILITADA: los datos se muestran en tiempo real pero no se guardan en base de datos.");
                            persistence_warned = true;
                        }
                        last_save = tokio::time::Instant::now();
                        tokio::time::sleep(Duration::from_secs(config.cycle_interval_secs)).await;
                        continue;
                    }

                    let should_save = (!config.db_save_only_on_therapy || is_in_therapy)
                        && current_therapy_id.is_some();

                    if should_save {
                        println!("[DB] Guardando snapshot de ciclo {} ({} lecturas)...", cycle, readings.len());
                        let mut readings_to_save = readings.clone();
                        for reading in &mut readings_to_save {
                            reading.therapy_id = current_therapy_id;
                        }
                        if let Err(e) = interactor.save_telemetry(&readings_to_save).await {
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
                // Drop the error BEFORE awaiting to avoid Send issues
                drop(e);

                serial_manager.record_failure().await;
                broadcast_serial_status(ws_hub, &serial_manager).await;

                let current = serial_manager.get_status().await;
                if current.status == "FailedLimit" {
                    eprintln!(
                        "[Serial] Límite de {} fallos consecutivos alcanzado. Suspendiendo lectura.",
                        current.max_failures
                    );
                    return;
                }
            }
        }
        tokio::time::sleep(Duration::from_secs(config.cycle_interval_secs)).await;
    }
}

// ─────────────────────────────────────────────────────────────────
//  Entry point
// ─────────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("╔══════════════════════════════════════════════╗");
    println!("║   PDMS-Omni · B.Braun OMNI-ODI Client        ║");
    println!("╚══════════════════════════════════════════════╝\n");

    // 1. Configuración
    let config = Arc::new(AppConfig::from_env());
    println!(
        "[Config] DB={}, Puerto={}, Baudrate={}, Timeout={}s, WS=ws://{}:{}/ws, MaxFallos={}",
        config.get_database_url_redacted(),
        config.port_name,
        config.baudrate,
        config.serial_timeout_secs,
        config.ws_host,
        config.ws_port,
        config.serial_max_failures,
    );
    match config.capture_mode {
        CaptureMode::All => println!("[Config] Captura: ALL"),
        CaptureMode::Selected => println!(
            "[Config] Captura: SELECTED (handles={}, names={})",
            config.capture_handles.len(),
            config.capture_names.len()
        ),
    }

    let ws_addr = format!("{}:{}", config.ws_host, config.ws_port).parse()?;

    // 2. Base de datos
    let db_config = config.database_config();
    let (repos, persistence_enabled) = match database::initialize_db(&db_config).await {
        Ok(repos) => {
            println!("[DB] Conectada: {}", config.get_database_url_redacted());
            (repos, true)
        }
        Err(e) => {
            eprintln!("[DB] ERROR de conexión: {}", e);
            eprintln!("[DB] Persistencia deshabilitada: lectura serial continuará sin guardar datos.");
            (database::initialize_without_persistence(), false)
        }
    };

    // 3. Serial Reader Manager — starts stopped; user must start manually from dashboard
    let (serial_manager, mut cmd_rx, _state_arc) =
        SerialReaderManager::new(config.serial_max_failures, false);
    let serial_manager = Arc::new(serial_manager);

    // 4. WebSocket + HTTP API
    let ws_hub = WebSocketHub::start(
        ws_addr,
        repos.db.clone(),
        persistence_enabled,
        config.jwt_secret.clone(),
        config.jwt_token_ttl_secs(),
        Arc::clone(&serial_manager),
    )?;

    // 5. Dedicated OS thread for serial reading (avoids Send constraint on SerialPort)
    {
        let config_thread = Arc::clone(&config);
        let repos_thread = repos.clone();
        let ws_hub_thread = ws_hub.clone();
        let sm_thread = Arc::clone(&serial_manager);

        std::thread::spawn(move || {
            let mut current_session_id: Option<u64> = None;

            loop {
                // Read the current command without blocking on the watch channel from a thread
                let cmd = *cmd_rx.borrow_and_update();

                match cmd {
                    ReaderCommand::Start { id, new_therapy } => {
                        if current_session_id == Some(id) {
                            // Same session already running — wait for next command
                            // Use a blocking wait: create a tiny rt just for the wait
                            let rt = tokio::runtime::Builder::new_current_thread()
                                .enable_all()
                                .build()
                                .expect("rt for wait");
                            let changed = rt.block_on(async { cmd_rx.changed().await });
                            if changed.is_err() {
                                break;
                            }
                            continue;
                        }
                        current_session_id = Some(id);

                        // Run reader session (blocks until stopped or failed)
                        run_reader_session_blocking(
                            Arc::clone(&config_thread),
                            repos_thread.clone(),
                            ws_hub_thread.clone(),
                            Arc::clone(&sm_thread),
                            persistence_enabled,
                            new_therapy,
                        );

                        // After session ends, wait for next command
                        let rt = tokio::runtime::Builder::new_current_thread()
                            .enable_all()
                            .build()
                            .expect("rt for wait");
                        let changed = rt.block_on(async { cmd_rx.changed().await });
                        if changed.is_err() {
                            break;
                        }
                    }
                    ReaderCommand::Stop => {
                        current_session_id = None;
                        // Wait for next command
                        let rt = tokio::runtime::Builder::new_current_thread()
                            .enable_all()
                            .build()
                            .expect("rt for wait");
                        let changed = rt.block_on(async { cmd_rx.changed().await });
                        if changed.is_err() {
                            break;
                        }
                    }
                }
            }
        });
    }

    // 6. Wait for Ctrl+C
    println!("\n[Servidor] Activo. Presiona Ctrl+C para detener.\n");
    tokio::signal::ctrl_c().await?;
    println!("[Servidor] Señal de apagado recibida. Cerrando servicio...");

    Ok(())
}

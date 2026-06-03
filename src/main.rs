//! PDMS-Omni: B.Braun OMNI-ODI Patient Data Management System client.
//! Built with Clean Architecture — all infrastructure is swappable.

mod application;
mod domain;
mod infrastructure;

use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use tracing::{debug, error, info, warn};

use crate::application::use_cases::OmniInteractor;
use crate::domain::entities::TelemetryReading;
use crate::infrastructure::config::{AppConfig, CaptureMode};
use crate::infrastructure::database;
use crate::infrastructure::database::Repositories;
use crate::infrastructure::logger;
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
    data_warnings: u32,
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
                error!("[Device] Inicialización fallida (intento {}/{}): {}", attempt, max_attempts, e);
                if attempt < max_attempts {
                    info!("[Device] Reintentando en {}s...", interval_secs);
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
        data_warnings: current.data_warnings,
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
            error!("[Serial] No se pudo abrir el puerto: {}", err);
            serial_manager.record_failure().await;
            broadcast_serial_status(ws_hub, &serial_manager).await;
            return;
        }
    };

    info!("[Serial] Puerto {} abierto (19200, 8N1)", config.port_name);

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
            error!("[Device] {}", e);
            serial_manager.record_failure().await;
            broadcast_serial_status(ws_hub, &serial_manager).await;
            return;
        }
    };

    info!("[OK] OMNI inicializado: System SW={}", version.system_sw);
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

    info!("[Loop] Lectura cíclica de valores (Ctrl+C para detener)...");

    loop {
        // Check if we should stop
        {
            let status = serial_manager.get_status().await;
            if status.status == "Stopped" || status.status == "FailedLimit" {
                info!("[Serial] Deteniendo lectura: {}", status.status);
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

        let ctx_patient = current_patient_key.clone().unwrap_or("—".to_string());
        let ctx_machine = current_serial_number.clone().unwrap_or("—".to_string());

        match cycle_result {
            Ok(readings) => {
                serial_manager.record_success().await;

                info!("[Ciclo {cycle}] [Máq: {ctx_machine}] [Pac: {ctx_patient}] {count} lecturas", count = readings.len());

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

                info!(
                    "[Ciclo {cycle}] [Máq: {ctx_machine}] [Pac: {ctx_patient}] Terapia activa: {act}, Estado: {est}",
                    act = is_in_therapy, est = therapy_state_name
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
                    info!("[EVENTO] [Máq: {ctx_machine}] Cambio de paciente: {p:?}", p = current_patient_key);
                }

                if serial_number != current_serial_number {
                    current_serial_number = serial_number.clone();
                    current_machine_id = None;
                    current_therapy_id = None;
                    info!("[EVENTO] Cambio de máquina: {s:?}", s = current_serial_number);
                }

                if is_in_therapy {
                    if current_machine_id.is_none() {
                        if let Some(serial) = current_serial_number.as_deref() {
                            if persistence_enabled {
                                match interactor.get_or_create_machine(serial, &software_version).await {
                                    Ok(machine_id) => current_machine_id = Some(machine_id),
                                    Err(e) => error!("[DB] [Máq: {ctx_machine}] No se pudo registrar la máquina: {e}"),
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
                                            Err(e) => error!("[DB] [Máq: {ctx_machine}] [Pac: {patient}] No se pudo abrir la terapia: {e}"),
                                        }
                                    }
                                    Err(e) => error!("[DB] [Pac: {patient}] No se pudo registrar el paciente: {e}"),
                                }
                            }
                        }
                    }

                    if !was_in_therapy && current_therapy_id.is_some() {
                        info!("[Therapy] [Máq: {ctx_machine}] [Pac: {ctx_patient}] INICIO de terapia detectado");
                    }
                } else if was_in_therapy {
                    info!("[Therapy] [Máq: {ctx_machine}] [Pac: {ctx_patient}] FIN de terapia detectado");
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
                            if let Some(disp) = &r.display_value {
                                debug!("  {:<30} = {:>10.2} {} ({})", r.internal_name, n, r.unit, disp);
                            } else {
                                debug!("  {:<30} = {:>10.2} {}", r.internal_name, n, r.unit);
                            }
                        }
                        TelemetryValue::String(s) => {
                            debug!("  {:<30} = {:>10} {}", r.internal_name, s, r.unit);
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
                    error!("[WS] [Ciclo {cycle}] No se pudo broadcast: {e}");
                }

                if last_save.elapsed() >= save_interval {
                    if !persistence_enabled {
                        if !persistence_warned {
                            warn!("[Persistencia] DESHABILITADA: datos en tiempo real pero no se guardan en BD.");
                            persistence_warned = true;
                        }
                        last_save = tokio::time::Instant::now();
                        tokio::time::sleep(Duration::from_secs(config.cycle_interval_secs)).await;
                        continue;
                    }

                    let should_save = (!config.db_save_only_on_therapy || is_in_therapy)
                        && current_therapy_id.is_some();

                    if should_save {
                        info!("[DB] [Ciclo {cycle}] [Máq: {ctx_machine}] [Pac: {ctx_patient}] Guardando snapshot ({count} lecturas)...", count = readings.len());
                        let mut readings_to_save = readings.clone();
                        for reading in &mut readings_to_save {
                            reading.therapy_id = current_therapy_id;
                        }
                        if let Err(e) = interactor.save_telemetry(&readings_to_save).await {
                            error!("[DB] [Ciclo {cycle}] ERROR al persistir snapshot: {e}");
                        } else {
                            last_save = tokio::time::Instant::now();
                        }
                    } else {
                        last_save = tokio::time::Instant::now();
                    }
                }
            }
            Err(e) => {
                use crate::domain::device::DeviceError;
                use crate::application::use_cases::UseCaseError;

                let is_connection_error = matches!(&e,
                    UseCaseError::Device(DeviceError::IoError(_))
                    | UseCaseError::Device(DeviceError::Timeout)
                );

                if is_connection_error {
                    error!("[Ciclo {cycle}] [Máq: {ctx_machine}] [Pac: {ctx_patient}] ERROR de conexión: {e}");
                    serial_manager.record_failure().await;
                    broadcast_serial_status(ws_hub, &serial_manager).await;

                    let current = serial_manager.get_status().await;
                    if current.status == "FailedLimit" {
                        error!(
                            "[Serial] Límite de {max} fallos consecutivos alcanzado. Suspendiendo lectura.",
                            max = current.max_failures
                        );
                        return;
                    }
                } else {
                    warn!("[Ciclo {cycle}] [Máq: {ctx_machine}] [Pac: {ctx_patient}] ADVERTENCIA de datos: {e}");
                    serial_manager.record_warning().await;
                    broadcast_serial_status(ws_hub, &serial_manager).await;
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
    // Initialize logging FIRST (file + console)
    let _guards = logger::init_logger(None);

    info!("╔══════════════════════════════════════════════╗");
    info!("║   PDMS-Omni · B.Braun OMNI-ODI Client        ║");
    info!("╚══════════════════════════════════════════════╝");

    // 1. Configuración
    let config = Arc::new(AppConfig::from_env());
    info!(
        "[Config] DB={url}, Puerto={port}, Baudrate={baud}, Timeout={to}s, WS=ws://{host}:{wport}/ws, MaxFallos={mf}",
        url = config.get_database_url_redacted(),
        port = config.port_name,
        baud = config.baudrate,
        to = config.serial_timeout_secs,
        host = config.ws_host,
        wport = config.ws_port,
        mf = config.serial_max_failures,
    );
    match config.capture_mode {
        CaptureMode::All => info!("[Config] Captura: ALL"),
        CaptureMode::Selected => info!(
            "[Config] Captura: SELECTED (handles={h}, names={n})",
            h = config.capture_handles.len(),
            n = config.capture_names.len()
        ),
    }

    let ws_addr = format!("{}:{}", config.ws_host, config.ws_port).parse()?;

    // 2. Base de datos
    let db_config = config.database_config();
    let (repos, persistence_enabled) = match database::initialize_db(&db_config).await {
        Ok(repos) => {
            info!("[DB] Conectada: {url}", url = config.get_database_url_redacted());
            (repos, true)
        }
        Err(e) => {
            error!("[DB] ERROR de conexión: {}", e);
            error!("[DB] Persistencia deshabilitada: lectura serial continuará sin guardar datos.");
            (database::initialize_without_persistence(), false)
        }
    };

    // 3. Serial Reader Manager — starts stopped; user must start manually from dashboard
    let (serial_manager, mut cmd_rx, _state_arc) =
        SerialReaderManager::new(config.serial_max_failures, false);
    let serial_manager = Arc::new(serial_manager);

    // 4. WebSocket + HTTP API
    let dashboard_path = config.dashboard_dir.as_ref().map(std::path::PathBuf::from);
    let ws_hub = WebSocketHub::start(
        ws_addr,
        repos.db.clone(),
        persistence_enabled,
        config.jwt_secret.clone(),
        config.jwt_token_ttl_secs(),
        Arc::clone(&serial_manager),
        dashboard_path,
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
    info!("[Servidor] Activo. Presiona Ctrl+C para detener.");
    tokio::signal::ctrl_c().await?;
    info!("[Servidor] Señal de apagado recibida. Cerrando servicio...");

    Ok(())
}

//! PDMS-Omni: B.Braun OMNI-ODI Patient Data Management System client.
//! Built with Clean Architecture — all infrastructure is swappable.

mod domain;
mod application;
mod infrastructure;

use std::time::Duration;

use crate::application::use_cases::OmniInteractor;
use crate::infrastructure::config::AppConfig;
use crate::infrastructure::database;
use crate::infrastructure::serial_communicator::{SerialConfig, SerialDeviceCommunicator};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("╔══════════════════════════════════════════════╗");
    println!("║   PDMS-Omni · B.Braun OMNI-ODI Client       ║");
    println!("║   Clean Architecture · RS-232 · SQLite       ║");
    println!("╚══════════════════════════════════════════════╝\n");

    // 1. Configuración
    let config = AppConfig::from_env();
    println!("[Config] DB={}, Puerto={}, Baudrate={}",
        config.db_path, config.port_name, config.baudrate);

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
    println!("[Serial] Puerto {} abierto (19200, 8N1)\n", config.port_name);

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

    // 5.5. Consulta de prueba a la Base de Datos (Historia y Metadatos)
    println!("\n[DB-CHECK] Verificando acceso a historial en SQLite...");
    if let Ok(Some(v)) = interactor.get_latest_version_from_db() {
        println!("      └─ Última versión almacenada en BD: {}", v.system_sw);
    }
    if let Ok(Some(attr)) = interactor.get_attribute_by_handle(1) {
        println!("      └─ Validando Atributo (Handle 1): {}", attr.internal_name);
    }
    if let Ok(readings) = interactor.get_recent_readings_from_db(5) {
        println!("      └─ Se recobraron con éxito {} lecturas previas.", readings.len());
    }

    // 6. Fase cíclica: lectura de valores cada segundo
    println!("\n[Loop] Lectura cíclica de valores (Ctrl+C para detener)...\n");
    let mut cycle: u64 = 0;

    loop {
        cycle += 1;
        match interactor.get_cyclical_values() {
            Ok(readings) => {
                println!("── Ciclo {} ── {} lecturas ──", cycle, readings.len());
                for r in &readings {
                    println!("  {:30} = {:>10.2} {}", r.internal_name, r.physical_value, r.unit);
                }
            }
            Err(e) => {
                eprintln!("[ERROR] Ciclo {}: {}", cycle, e);
            }
        }
        std::thread::sleep(Duration::from_secs(1));
    }
}

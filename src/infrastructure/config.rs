use dotenvy::dotenv;
use std::env;
use std::collections::HashSet;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CaptureMode {
    All,
    Selected,
}

pub struct AppConfig {
    pub port_name: String,
    pub baudrate: u32,
    pub serial_timeout_secs: u64,
    pub db_path: String,
    pub src_addr: u8,
    pub dst_addr: u8,
    pub ws_host: String,
    pub ws_port: u16,
    pub cycle_interval_secs: u64,
    pub capture_mode: CaptureMode,
    pub capture_handles: HashSet<u16>,
    pub capture_names: HashSet<String>,
}

impl AppConfig {
    pub fn from_env() -> Self {
        dotenv().ok(); // Carga el archivo .env

        let capture_mode = match env::var("CAPTURE_MODE")
            .unwrap_or_else(|_| "all".to_string())
            .to_ascii_lowercase()
            .as_str()
        {
            "selected" => CaptureMode::Selected,
            _ => CaptureMode::All,
        };

        Self {
            port_name: env::var("SERIAL_PORT").unwrap_or_else(|_| "COM6".to_string()),
            baudrate: env::var("SERIAL_BAUDRATE")
                .unwrap_or_default()
                .parse()
                .unwrap_or(19200),
            serial_timeout_secs: env::var("SERIAL_TIMEOUT")
                .unwrap_or_default()
                .parse()
                .unwrap_or(2),
            db_path: env::var("DB_DATABASE").unwrap_or_else(|_| "database.db".to_string()),
            src_addr: env::var("SRC_ADDR")
                .unwrap_or_default()
                .parse()
                .unwrap_or(11),
            dst_addr: env::var("DST_ADDR")
                .unwrap_or_default()
                .parse()
                .unwrap_or(1),
            ws_host: env::var("WS_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            ws_port: env::var("WS_PORT")
                .unwrap_or_default()
                .parse()
                .unwrap_or(9001),
            cycle_interval_secs: env::var("CYCLE_INTERVAL")
                .unwrap_or_default()
                .parse()
                .unwrap_or(1),
            capture_mode,
            capture_handles: parse_handles_csv(&env::var("CAPTURE_HANDLES").unwrap_or_default()),
            capture_names: parse_names_csv(&env::var("CAPTURE_NAMES").unwrap_or_default()),
        }
    }
}

fn parse_handles_csv(raw: &str) -> HashSet<u16> {
    raw.split(',')
        .filter_map(|s| {
            let token = s.trim();
            if token.is_empty() {
                return None;
            }

            let parsed = if let Some(hex) = token.strip_prefix("0x").or_else(|| token.strip_prefix("0X")) {
                u16::from_str_radix(hex, 16).ok()
            } else {
                token.parse::<u16>().ok()
            };

            if parsed.is_none() {
                eprintln!("[Config] CAPTURE_HANDLES ignora valor invalido: {}", token);
            }

            parsed
        })
        .collect()
}

fn parse_names_csv(raw: &str) -> HashSet<String> {
    raw.split(',')
        .filter_map(|s| {
            let token = s.trim();
            if token.is_empty() {
                None
            } else {
                Some(token.to_ascii_lowercase())
            }
        })
        .collect()
}

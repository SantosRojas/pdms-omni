use dotenvy::dotenv;
use std::env;

pub struct AppConfig {
    pub port_name: String,
    pub baudrate: u32,
    pub db_path: String,
    pub src_addr: u8,
    pub dst_addr: u8,
}

impl AppConfig {
    pub fn from_env() -> Self {
        dotenv().ok(); // Carga el archivo .env

        Self {
            port_name: env::var("SERIAL_PORT").unwrap_or_else(|_| "COM6".to_string()),
            baudrate: env::var("SERIAL_BAUDRATE")
                .unwrap_or_default()
                .parse()
                .unwrap_or(19200),
            db_path: env::var("DB_DATABASE").unwrap_or_else(|_| "database.db".to_string()),
            src_addr: env::var("SRC_ADDR")
                .unwrap_or_default()
                .parse()
                .unwrap_or(11),
            dst_addr: env::var("DST_ADDR")
                .unwrap_or_default()
                .parse()
                .unwrap_or(1),
        }
    }
}

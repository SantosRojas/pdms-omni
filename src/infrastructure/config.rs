use dotenvy;
use std::collections::HashSet;
use std::env;
use std::sync::OnceLock;
use tracing::warn;

static CONFIG_WARNED: OnceLock<()> = OnceLock::new();

fn warn_once(msg: &str) {
    if CONFIG_WARNED.set(()).is_ok() {
        warn!("[Config] {}", msg);
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CaptureMode {
    All,
    Selected,
}

#[derive(Debug, Clone)]
pub struct MssqlSettings {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: String,
    pub trust_server_certificate: bool,
}

#[derive(Debug, Clone)]
pub struct PostgresSettings {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone)]
pub enum DatabaseConfig {
    Sqlite { url: String },
    Mssql(MssqlSettings),
    Postgres(PostgresSettings),
    Other { url: String },
}

pub struct AppConfig {
    pub port_name: String,
    pub baudrate: u32,
    pub serial_timeout_secs: u64,
    pub db_connection: String,
    pub db_host: String,
    pub db_port: String,
    pub db_database: String,
    pub db_username: String,
    pub db_password: String,
    pub src_addr: u8,
    pub dst_addr: u8,
    pub ws_host: String,
    pub ws_port: u16,
    pub cycle_interval_secs: u64,
    pub db_save_interval_secs: u64,
    pub db_save_only_on_therapy: bool,

    pub device_init_retry_max_attempts: u32,
    pub device_init_retry_interval_secs: u64,
    pub jwt_secret: String,
    pub jwt_expiration_hours: u64,
    pub capture_mode: CaptureMode,
    pub capture_handles: HashSet<u16>,
    pub capture_names: HashSet<String>,
    pub serial_max_failures: u32,
    pub dashboard_dir: Option<String>,
    pub admin_password: String,
    pub cors_origins: Vec<String>,
}

impl AppConfig {
    pub fn from_env() -> Self {
        // Find and load .env; remember its directory to resolve relative paths
        let env_dir = dotenvy::dotenv()
            .ok()
            .and_then(|p| p.parent().map(|d| d.to_path_buf()))
            .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());

        let capture_mode = match env::var("CAPTURE_MODE")
            .unwrap_or_else(|_| "all".to_string())
            .to_ascii_lowercase()
            .as_str()
        {
            "selected" => CaptureMode::Selected,
            _ => CaptureMode::All,
        };

        // Resolve DB path relative to the .env directory
        let db_connection = env::var("DB_CONNECTION").unwrap_or_else(|_| "sqlite".to_string());
        let db_username = env::var("DB_USERNAME").unwrap_or_else(|_| "root".to_string());
        let db_password = env::var("DB_PASSWORD").unwrap_or_default();
        let db_host = env::var("DB_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
        let db_port = env::var("DB_PORT").unwrap_or_else(|_| "1433".to_string());

        // Warn or fail early for invalid/missing configuration
        let driver_lc = db_connection.to_ascii_lowercase();
        if driver_lc != "sqlite" && db_password.is_empty() {
            warn!(
                "[Config] DB_PASSWORD no está definido para '{}'. Verifica tu archivo .env",
                db_connection
            );
        }
        if driver_lc != "sqlite"
            && (db_host == "127.0.0.1" && db_port == "1433" && db_username == "root")
        {
            warn!(
                "[Config] Parece que DB_HOST/DB_PORT/DB_USERNAME usan valores por defecto para '{}'. \
                 Verifica tu archivo .env",
                db_connection
            );
        }

        let db_raw = env::var("DB_DATABASE").unwrap_or_else(|_| "database.db".to_string());
        // For sqlite, resolve relative to .env directory, else use raw name
        let db_database = if db_connection == "sqlite" {
            if std::path::Path::new(&db_raw).is_absolute() {
                db_raw
            } else {
                env_dir.join(&db_raw).to_string_lossy().to_string()
            }
        } else {
            db_raw
        };

        // Log invalid config values for production safety
        let baudrate_raw = env::var("SERIAL_BAUDRATE").unwrap_or_default();
        let baudrate: u32 = baudrate_raw.parse().unwrap_or_else(|_| {
            if !baudrate_raw.is_empty() {
                warn_once(&format!(
                    "SERIAL_BAUDRATE '{}' inválido, usando 19200",
                    baudrate_raw
                ));
            }
            19200
        });
        let serial_timeout_secs = env::var("SERIAL_TIMEOUT")
            .unwrap_or_default()
            .parse()
            .unwrap_or(2);
        let cycle_interval_secs: u64 = env::var("CYCLE_INTERVAL")
            .unwrap_or_default()
            .parse()
            .unwrap_or(1);
        let db_save_interval_secs: u64 = env::var("DB_SAVE_INTERVAL")
            .unwrap_or_default()
            .parse()
            .unwrap_or(60);
        if db_save_interval_secs < cycle_interval_secs {
            warn_once(&format!(
                "DB_SAVE_INTERVAL ({}) < CYCLE_INTERVAL ({}); los datos nunca se guardarán",
                db_save_interval_secs, cycle_interval_secs
            ));
        }

        let db_save_only_on_therapy = env::var("DB_SAVE_ONLY_ON_THERAPY")
            .map(|v| v.eq_ignore_ascii_case("true"))
            .unwrap_or(false);

        Self {
            port_name: env::var("SERIAL_PORT").unwrap_or_else(|_| "COM6".to_string()),
            baudrate,
            serial_timeout_secs,
            db_connection,
            db_host,
            db_port,
            db_database,
            db_username,
            db_password,
            src_addr: env::var("SRC_ADDR")
                .unwrap_or_default()
                .parse()
                .unwrap_or(11),
            dst_addr: env::var("DST_ADDR")
                .unwrap_or_default()
                .parse()
                .unwrap_or(1),
            ws_host: env::var("WS_HOST").unwrap_or_else(|_| "127.0.0.1".to_string()),
            ws_port: env::var("WS_PORT")
                .unwrap_or_default()
                .parse()
                .unwrap_or(9001),
            cycle_interval_secs,
            db_save_interval_secs,
            db_save_only_on_therapy,
            device_init_retry_max_attempts: env::var("DEVICE_INIT_RETRY_MAX_ATTEMPTS")
                .unwrap_or_default()
                .parse()
                .unwrap_or(10),
            device_init_retry_interval_secs: env::var("DEVICE_INIT_RETRY_INTERVAL")
                .unwrap_or_default()
                .parse()
                .unwrap_or(5),
            jwt_secret: env::var("JWT_SECRET").expect("JWT_SECRET must be set in .env"),
            jwt_expiration_hours: env::var("JWT_EXPIRATION_HOURS")
                .unwrap_or_default()
                .parse()
                .unwrap_or(24),
            admin_password: env::var("ADMIN_PASSWORD").expect("ADMIN_PASSWORD must be set in .env"),
            cors_origins: parse_cors_origins(
                &env::var("CORS_ORIGINS")
                    .unwrap_or_else(|_| "http://localhost:5173,http://localhost:9001".to_string()),
            ),
            capture_mode,
            capture_handles: parse_handles_csv(&env::var("CAPTURE_HANDLES").unwrap_or_default()),
            capture_names: parse_names_csv(&env::var("CAPTURE_NAMES").unwrap_or_default()),
            serial_max_failures: env::var("SERIAL_MAX_FAILURES")
                .unwrap_or_default()
                .parse()
                .unwrap_or(5),
            dashboard_dir: {
                let env_val = env::var("DASHBOARD_DIR").ok();
                if let Some(dir) = env_val {
                    if std::path::Path::new(&dir).exists() {
                        Some(dir)
                    } else {
                        warn!("[Config] DASHBOARD_DIR \"{}\" no existe, ignorando", dir);
                        None
                    }
                } else {
                    // Try next to the executable, then cwd/dashboard/dist
                    std::env::current_exe()
                        .ok()
                        .and_then(|p| p.parent().map(|d| d.join("dashboard")))
                        .filter(|p| p.exists())
                        .or_else(|| {
                            let cwd = std::env::current_dir().ok()?;
                            let from_cwd = cwd.join("dashboard").join("dist");
                            if from_cwd.exists() {
                                Some(from_cwd)
                            } else {
                                None
                            }
                        })
                        .map(|p| p.to_string_lossy().to_string())
                }
            },
        }
    }

    pub fn jwt_token_ttl_secs(&self) -> u64 {
        self.jwt_expiration_hours.max(1) * 60 * 60
    }

    pub fn database_config(&self) -> DatabaseConfig {
        let driver = self.db_connection.to_ascii_lowercase();
        match driver.as_str() {
            "sqlite" => DatabaseConfig::Sqlite {
                url: format!("sqlite://{}", self.db_database),
            },
            "mssql" | "sqlsrv" => DatabaseConfig::Mssql(MssqlSettings {
                host: self.db_host.clone(),
                port: self.db_port.parse::<u16>().unwrap_or(1433),
                database: self.db_database.clone(),
                username: self.db_username.clone(),
                password: self.db_password.clone(),
                trust_server_certificate: env::var("DB_TRUST_SERVER_CERTIFICATE")
                    .map(|v| v.eq_ignore_ascii_case("true"))
                    .unwrap_or(true),
            }),
            "postgres" | "pgsql" | "postgresql" => DatabaseConfig::Postgres(PostgresSettings {
                host: self.db_host.clone(),
                port: self.db_port.parse::<u16>().unwrap_or(5432),
                database: self.db_database.clone(),
                username: self.db_username.clone(),
                password: self.db_password.clone(),
            }),
            "mysql" => DatabaseConfig::Other {
                url: format!(
                    "mysql://{}:{}@{}:{}/{}",
                    self.db_username,
                    self.db_password,
                    self.db_host,
                    self.db_port,
                    self.db_database
                ),
            },
            _ => DatabaseConfig::Other {
                url: format!("{}://{}", self.db_connection, self.db_database),
            },
        }
    }

    pub fn get_database_url_redacted(&self) -> String {
        match self.database_config() {
            DatabaseConfig::Sqlite { url } => url,
            DatabaseConfig::Mssql(cfg) => format!(
                "mssql://{}:***@{}:{}/{}",
                cfg.username, cfg.host, cfg.port, cfg.database
            ),
            DatabaseConfig::Postgres(cfg) => format!(
                "postgresql://{}:***@{}:{}/{}",
                cfg.username, cfg.host, cfg.port, cfg.database
            ),
            DatabaseConfig::Other { .. } => format!("{}://***", self.db_connection),
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

            let parsed = if let Some(hex) = token
                .strip_prefix("0x")
                .or_else(|| token.strip_prefix("0X"))
            {
                u16::from_str_radix(hex, 16).ok()
            } else {
                token.parse::<u16>().ok()
            };

            if parsed.is_none() {
                warn!("[Config] CAPTURE_HANDLES ignora valor invalido: {}", token);
            }

            parsed
        })
        .collect()
}

fn parse_cors_origins(raw: &str) -> Vec<String> {
    raw.split(',')
        .filter_map(|s| {
            let token = s.trim();
            if token.is_empty() {
                None
            } else {
                Some(token.to_string())
            }
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

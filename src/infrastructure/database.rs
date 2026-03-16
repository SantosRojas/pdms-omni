//! Database initialization and connection management.
//! Extracts all SQLite-specific setup from main.rs.

use rusqlite::Connection;
use std::sync::{Arc, Mutex};

use super::sqlite_repository::{
    SqliteDataAttrRepository, SqliteDictionaryRepository,
    SqliteTelemetryRepository, SqliteVersionRepository,
};

/// All repository instances bundled together for easy injection.
pub struct Repositories {
    pub attr_repo: SqliteDataAttrRepository,
    pub dict_repo: SqliteDictionaryRepository,
    pub telemetry_repo: SqliteTelemetryRepository,
    pub version_repo: SqliteVersionRepository,
}

/// Initializes the SQLite database: opens connection, creates schema,
/// and returns all repository instances ready for injection.
pub fn initialize_sqlite(db_path: &str) -> Result<Repositories, Box<dyn std::error::Error>> {
    let conn = Connection::open(db_path)?;

    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            language_id INTEGER,
            system_sw TEXT,
            dss_fw TEXT, dss_hw TEXT,
            css_fw TEXT, css_hw TEXT,
            pss_fw TEXT, pss_hw TEXT,
            lang1 TEXT, lang2 TEXT, lang3 TEXT
        );
        CREATE TABLE IF NOT EXISTS data_attributes (
            handle INTEGER PRIMARY KEY,
            data_type INTEGER,
            size INTEGER,
            conversion_factor INTEGER,
            label_did INTEGER,
            unit_did INTEGER,
            internal_name TEXT
        );
        CREATE TABLE IF NOT EXISTS dictionary (
            dict_id INTEGER PRIMARY KEY,
            text TEXT
        );
        CREATE TABLE IF NOT EXISTS telemetry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            handle INTEGER,
            internal_name TEXT,
            raw_value INTEGER,
            physical_value REAL,
            unit TEXT
        );
    ")?;

    let db = Arc::new(Mutex::new(conn));

    Ok(Repositories {
        attr_repo:      SqliteDataAttrRepository::new(Arc::clone(&db)),
        dict_repo:      SqliteDictionaryRepository::new(Arc::clone(&db)),
        telemetry_repo: SqliteTelemetryRepository::new(Arc::clone(&db)),
        version_repo:   SqliteVersionRepository::new(Arc::clone(&db)),
    })
}

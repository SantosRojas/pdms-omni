//! Database initialization and connection management.
//! Extracts all SQLite-specific setup from main.rs.

use rusqlite::Connection;
use std::sync::{Arc, Mutex};

use super::sqlite_repository::{
    SqliteDataAttrRepository, SqliteDictionaryRepository,
    SqliteTelemetryRepository, SqliteVersionRepository,
    SqliteAttributeEquivalenceRepository,
};

/// All repository instances bundled together for easy injection.
pub struct Repositories {
    pub attr_repo: SqliteDataAttrRepository,
    pub dict_repo: SqliteDictionaryRepository,
    pub telemetry_repo: SqliteTelemetryRepository,
    pub version_repo: SqliteVersionRepository,
    pub equiv_repo: SqliteAttributeEquivalenceRepository,
    /// Shared DB connection for the HTTP API layer
    pub db: Arc<Mutex<Connection>>,
}

/// Initializes the SQLite database: opens connection, creates schema,
/// and returns all repository instances ready for injection.
pub fn initialize_sqlite(db_path: &str) -> Result<Repositories, Box<dyn std::error::Error>> {
    let mut conn = Connection::open(db_path)?;

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
        CREATE TABLE IF NOT EXISTS signals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            internal_name TEXT UNIQUE
        );
        CREATE TABLE IF NOT EXISTS data_attributes (
            handle INTEGER PRIMARY KEY,
            data_type INTEGER,
            size INTEGER,
            conversion_factor INTEGER,
            label_did INTEGER,
            unit_did INTEGER,
            signal_id INTEGER,
            FOREIGN KEY(signal_id) REFERENCES signals(id)
        );
        CREATE TABLE IF NOT EXISTS dictionary (
            dict_id INTEGER PRIMARY KEY,
            text TEXT
        );
        -- Patient tracking table
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id_str TEXT UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        -- Normalizing telemetry: storing signal_id for permanent historical decoupling
        CREATE TABLE IF NOT EXISTS telemetry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            patient_id INTEGER,
            signal_id INTEGER,
            raw_value INTEGER,
            physical_value NUMERIC,
            unit TEXT,
            FOREIGN KEY(patient_id) REFERENCES patients(id),
            FOREIGN KEY(signal_id) REFERENCES signals(id)
        );
        -- New table for equivalences, using signal_id
        -- numeric_value is the PHYSICAL (final) value, not the raw transmitted bytes
        CREATE TABLE IF NOT EXISTS attribute_equivalences (
            signal_id INTEGER,
            numeric_value REAL,
            display_name TEXT,
            PRIMARY KEY (signal_id, numeric_value),
            FOREIGN KEY(signal_id) REFERENCES signals(id)
        );
        -- User management
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'viewer',
            active INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    ")?;

    // Seed default admin user if no users exist
    let user_count: i64 = conn.query_row("SELECT COUNT(*) FROM users", [], |r| r.get(0)).unwrap_or(0);
    if user_count == 0 {
        conn.execute(
            "INSERT INTO users (username, password, role) VALUES ('admin', 'admin123', 'admin')",
            [],
        )?;
        println!("  [DB] Default admin user created (username: admin, password: admin123)");
    }

    let count: i64 = conn.query_row("SELECT COUNT(*) FROM attribute_equivalences", [], |r| r.get(0)).unwrap_or(0);
    if count == 0 {
        use crate::infrastructure::equivalences_data::EQUIVALENCES;
        let tx = conn.transaction()?;
        for eq in EQUIVALENCES {
            tx.execute(
                "INSERT OR IGNORE INTO signals (internal_name) VALUES (?1)",
                rusqlite::params![eq.internal_name]
            )?;
            let signal_id: i64 = tx.query_row(
                "SELECT id FROM signals WHERE internal_name = ?1",
                rusqlite::params![eq.internal_name],
                |r| r.get(0)
            )?;
            tx.execute(
                "INSERT OR REPLACE INTO attribute_equivalences (signal_id, numeric_value, display_name) VALUES (?1, ?2, ?3)",
                rusqlite::params![signal_id, eq.numeric_value, eq.display_name]
            )?;
        }
        tx.commit()?;
        println!("  [DB] Embedded equivalences initialized.");
    }

    let db = Arc::new(Mutex::new(conn));

    Ok(Repositories {
        attr_repo:      SqliteDataAttrRepository::new(Arc::clone(&db)),
        dict_repo:      SqliteDictionaryRepository::new(Arc::clone(&db)),
        telemetry_repo: SqliteTelemetryRepository::new(Arc::clone(&db)),
        version_repo:   SqliteVersionRepository::new(Arc::clone(&db)),
        equiv_repo:     SqliteAttributeEquivalenceRepository::new(Arc::clone(&db)),
        db,
    })
}

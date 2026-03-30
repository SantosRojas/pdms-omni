//! Database initialization and connection management using sqlx.
//! Generates schema and populates tables as needed.

use sqlx::{sqlite::SqliteConnectOptions, sqlite::SqliteJournalMode, SqlitePool, Row};
use std::str::FromStr;

use super::sqlx_repository::{
    SqlxDataAttrRepository, SqlxDictionaryRepository,
    SqlxTelemetryRepository, SqlxVersionRepository,
    SqlxAttributeEquivalenceRepository,
};

/// All repository instances bundled together for easy injection.
pub struct Repositories {
    pub attr_repo: SqlxDataAttrRepository,
    pub dict_repo: SqlxDictionaryRepository,
    pub telemetry_repo: SqlxTelemetryRepository,
    pub version_repo: SqlxVersionRepository,
    pub equiv_repo: SqlxAttributeEquivalenceRepository,
    /// Shared DB connection for the HTTP API layer
    pub db: SqlitePool,
}

/// Initializes the sqlx SQLite database: opens connection, creates schema,
/// and returns all repository instances ready for injection.
pub async fn initialize_db(db_url: &str) -> Result<Repositories, Box<dyn std::error::Error>> {
    let options = SqliteConnectOptions::from_str(db_url)?
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal);
    
    // Connect to database
    let pool = SqlitePool::connect_with(options).await?;

    // Execute schema migrations
    sqlx::query(
        "
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
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id_str TEXT UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            therapy_start DATETIME,
            therapy_end DATETIME
        );
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
        CREATE TABLE IF NOT EXISTS attribute_equivalences (
            signal_id INTEGER,
            numeric_value REAL,
            display_name TEXT,
            PRIMARY KEY (signal_id, numeric_value),
            FOREIGN KEY(signal_id) REFERENCES signals(id)
        );
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT NOT NULL DEFAULT '',
            email TEXT NOT NULL DEFAULT '',
            role TEXT NOT NULL DEFAULT 'viewer',
            active INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        "
    ).execute(&pool).await?;

    // Safe migrations for existing DB
    let _ = sqlx::query("ALTER TABLE users ADD COLUMN full_name TEXT NOT NULL DEFAULT ''").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT ''").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE patients ADD COLUMN therapy_start DATETIME").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE patients ADD COLUMN therapy_end DATETIME").execute(&pool).await;

    // Seed default admin user if no users exist
    let row = sqlx::query("SELECT COUNT(*) FROM users").fetch_one(&pool).await?;
    let user_count: i64 = row.get(0);
    
    if user_count == 0 {
        sqlx::query(
            "INSERT INTO users (username, password, full_name, role) VALUES ('admin', 'admin123', 'Administrator', 'admin')"
        ).execute(&pool).await?;
        println!("  [DB] Default admin user created (username: admin, password: admin123)");
    }

    let row = sqlx::query("SELECT COUNT(*) FROM attribute_equivalences").fetch_one(&pool).await?;
    let count: i64 = row.get(0);
    
    if count == 0 {
        use crate::infrastructure::equivalences_data::EQUIVALENCES;
        let mut tx = pool.begin().await?;
        for eq in EQUIVALENCES {
            sqlx::query("INSERT OR IGNORE INTO signals (internal_name) VALUES (?1)")
                .bind(eq.internal_name)
                .execute(&mut *tx).await?;
                
            let row = sqlx::query("SELECT id FROM signals WHERE internal_name = ?1")
                .bind(eq.internal_name)
                .fetch_one(&mut *tx).await?;
            let signal_id: i64 = row.get(0);
            
            sqlx::query(
                "INSERT OR REPLACE INTO attribute_equivalences (signal_id, numeric_value, display_name) VALUES (?1, ?2, ?3)"
            )
            .bind(signal_id)
            .bind(eq.numeric_value)
            .bind(eq.display_name)
            .execute(&mut *tx).await?;
        }
        tx.commit().await?;
        println!("  [DB] Embedded equivalences initialized.");
    }

    Ok(Repositories {
        attr_repo:      SqlxDataAttrRepository::new(pool.clone()),
        dict_repo:      SqlxDictionaryRepository::new(pool.clone()),
        telemetry_repo: SqlxTelemetryRepository::new(pool.clone()),
        version_repo:   SqlxVersionRepository::new(pool.clone()),
        equiv_repo:     SqlxAttributeEquivalenceRepository::new(pool.clone()),
        db:             pool,
    })
}

//! Database initialization and connection management.
//! Supports SQLite (via sqlx), PostgreSQL (via sqlx), and MSSQL (via tiberius + bb8).
//! Detects backend from the DB_CONNECTION environment variable.

use sqlx::{sqlite::SqliteConnectOptions, sqlite::SqliteJournalMode, SqlitePool, Row as SqlxRow};
use sqlx::postgres::PgPoolOptions;
use bb8::Pool;
use bb8_tiberius::ConnectionManager;
use tiberius::{AuthMethod, Config as TibConfig, Row as TibRow, Query as TibQuery};
use std::str::FromStr;
use std::io;

use super::db_pool::DbPool;
use super::config::{DatabaseConfig, MssqlSettings, PostgresSettings};
use super::null_repository::{
    NullAttributeEquivalenceRepository, NullDataAttrRepository, NullDictionaryRepository,
    NullTelemetryRepository, NullVersionRepository,
};
use super::repo_dispatch::*;
use super::sqlx_repository::*;
use super::postgres_repository::*;
use super::mssql_repository::*;
use super::auth::hash_password;

/// All repository instances bundled together for easy injection.
/// Uses enum dispatch so the same struct works for both SQLite and MSSQL.
#[derive(Clone)]
pub struct Repositories {
    pub attr_repo:      DynAttrRepo,
    pub dict_repo:      DynDictRepo,
    pub telemetry_repo: DynTelemetryRepo,
    pub version_repo:   DynVersionRepo,
    pub equiv_repo:     DynEquivRepo,
    /// Shared DB pool for the HTTP API layer
    pub db: Option<DbPool>,
}

/// Initializes the database: opens connection, creates schema,
/// and returns all repository instances ready for injection.
pub async fn initialize_db(db_config: &DatabaseConfig) -> Result<Repositories, Box<dyn std::error::Error>> {
    match db_config {
        DatabaseConfig::Sqlite { url } => initialize_sqlite(url).await,
        DatabaseConfig::Postgres(cfg) => initialize_postgres(cfg).await,
        DatabaseConfig::Mssql(cfg) => initialize_mssql(cfg).await,
        DatabaseConfig::Other { url } => {
            Err(format!("DB backend not implemented yet for URL: {}", url).into())
        }
    }
}

/// Builds in-memory/no-op repositories for degraded operation without persistence.
pub fn initialize_without_persistence() -> Repositories {
    Repositories {
        attr_repo:      DynAttrRepo::Null(NullDataAttrRepository::new()),
        dict_repo:      DynDictRepo::Null(NullDictionaryRepository::new()),
        telemetry_repo: DynTelemetryRepo::Null(NullTelemetryRepository::new()),
        version_repo:   DynVersionRepo::Null(NullVersionRepository::new()),
        equiv_repo:     DynEquivRepo::Null(NullAttributeEquivalenceRepository::new()),
        db:             None,
    }
}

// ═══════════════════════════════════════════════════════════════
//  SQLite backend (existing)
// ═══════════════════════════════════════════════════════════════

async fn initialize_sqlite(db_url: &str) -> Result<Repositories, Box<dyn std::error::Error>> {
    let options = SqliteConnectOptions::from_str(db_url)?
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal);

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
        CREATE TABLE IF NOT EXISTS machines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            serial_number TEXT NOT NULL,
            software_version TEXT NOT NULL,
            registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT,
            UNIQUE(serial_number, software_version)
        );
        CREATE TABLE IF NOT EXISTS therapies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            patient_id INTEGER NOT NULL,
            machine_id INTEGER NOT NULL,
            status TEXT,
            ended_at DATETIME,
            FOREIGN KEY(patient_id) REFERENCES patients(id),
            FOREIGN KEY(machine_id) REFERENCES machines(id)
        );
        CREATE TABLE IF NOT EXISTS therapy_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            therapy_id INTEGER NOT NULL,
            author_name TEXT NOT NULL DEFAULT '',
            comment TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(therapy_id) REFERENCES therapies(id)
        );
        CREATE TABLE IF NOT EXISTS telemetry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            therapy_id INTEGER,
            signal_id INTEGER,
            raw_value INTEGER,
            physical_value NUMERIC,
            unit TEXT,
            FOREIGN KEY(therapy_id) REFERENCES therapies(id),
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

    // Query-performance indexes (safe, idempotent)
    sqlx::query(
        "
        CREATE INDEX IF NOT EXISTS idx_signals_internal_name ON signals(internal_name);
        CREATE INDEX IF NOT EXISTS idx_patients_patient_id_str ON patients(patient_id_str);
        CREATE INDEX IF NOT EXISTS idx_machines_serial_version ON machines(serial_number, software_version);
        CREATE INDEX IF NOT EXISTS idx_therapies_patient_machine ON therapies(patient_id, machine_id, ended_at);
        CREATE INDEX IF NOT EXISTS idx_telemetry_therapy_timestamp ON telemetry(therapy_id, timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_telemetry_signal ON telemetry(signal_id);
        CREATE INDEX IF NOT EXISTS idx_equiv_signal_numeric ON attribute_equivalences(signal_id, numeric_value);
        CREATE INDEX IF NOT EXISTS idx_therapy_comments_therapy ON therapy_comments(therapy_id, created_at);
        "
    ).execute(&pool).await?;

    // Safe migrations for existing DB
    let _ = sqlx::query("ALTER TABLE users ADD COLUMN full_name TEXT NOT NULL DEFAULT ''").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT ''").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE patients ADD COLUMN therapy_start DATETIME").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE patients ADD COLUMN therapy_end DATETIME").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE telemetry ADD COLUMN therapy_id INTEGER").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE therapy_comments ADD COLUMN deleted_at DATETIME").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE therapy_comments ADD COLUMN deletion_reason TEXT").execute(&pool).await;

    // Seed default admin user if no users exist
    let row = sqlx::query("SELECT COUNT(*) FROM users").fetch_one(&pool).await?;
    let user_count: i64 = row.get(0);
    if user_count == 0 {
        let admin_password_hash = hash_password("admin123")
            .map_err(|e| io::Error::other(e.to_string()))?;
        sqlx::query(
            "INSERT INTO users (username, password, full_name, role) VALUES ('admin', ?1, 'Administrator', 'admin')"
        ).bind(admin_password_hash).execute(&pool).await?;
        println!("  [DB] Default admin user created (username: admin, password: admin123)");
    }

    // Seed equivalences
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
        attr_repo:      DynAttrRepo::Sqlite(SqlxDataAttrRepository::new(pool.clone())),
        dict_repo:      DynDictRepo::Sqlite(SqlxDictionaryRepository::new(pool.clone())),
        telemetry_repo: DynTelemetryRepo::Sqlite(SqlxTelemetryRepository::new(pool.clone())),
        version_repo:   DynVersionRepo::Sqlite(SqlxVersionRepository::new(pool.clone())),
        equiv_repo:     DynEquivRepo::Sqlite(SqlxAttributeEquivalenceRepository::new(pool.clone())),
        db:             Some(DbPool::Sqlite(pool)),
    })
}

async fn initialize_postgres(settings: &PostgresSettings) -> Result<Repositories, Box<dyn std::error::Error>> {
    println!("  [DB] Connecting to PostgreSQL...");

    let url = format!(
        "postgresql://{}:{}@{}:{}/{}",
        settings.username, settings.password, settings.host, settings.port, settings.database
    );
    let pool = PgPoolOptions::new().max_connections(8).connect(&url).await?;

    let schema_statements = vec![
        "CREATE TABLE IF NOT EXISTS versions (
            id BIGSERIAL PRIMARY KEY,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            language_id INTEGER,
            system_sw TEXT,
            dss_fw TEXT, dss_hw TEXT,
            css_fw TEXT, css_hw TEXT,
            pss_fw TEXT, pss_hw TEXT,
            lang1 TEXT, lang2 TEXT, lang3 TEXT
        )",
        "CREATE TABLE IF NOT EXISTS signals (
            id BIGSERIAL PRIMARY KEY,
            internal_name TEXT UNIQUE
        )",
        "CREATE TABLE IF NOT EXISTS data_attributes (
            handle INTEGER PRIMARY KEY,
            data_type INTEGER,
            size INTEGER,
            conversion_factor INTEGER,
            label_did INTEGER,
            unit_did INTEGER,
            signal_id BIGINT REFERENCES signals(id)
        )",
        "CREATE TABLE IF NOT EXISTS dictionary (
            dict_id INTEGER PRIMARY KEY,
            text TEXT
        )",
        "CREATE TABLE IF NOT EXISTS patients (
            id BIGSERIAL PRIMARY KEY,
            patient_id_str TEXT UNIQUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            therapy_start TIMESTAMPTZ,
            therapy_end TIMESTAMPTZ
        )",
        "CREATE TABLE IF NOT EXISTS machines (
            id BIGSERIAL PRIMARY KEY,
            serial_number TEXT NOT NULL,
            software_version TEXT NOT NULL,
            registered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            status TEXT,
            UNIQUE(serial_number, software_version)
        )",
        "CREATE TABLE IF NOT EXISTS therapies (
            id BIGSERIAL PRIMARY KEY,
            started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            patient_id BIGINT REFERENCES patients(id),
            machine_id BIGINT REFERENCES machines(id),
            status TEXT,
            ended_at TIMESTAMPTZ
        )",
        "CREATE TABLE IF NOT EXISTS therapy_comments (
            id BIGSERIAL PRIMARY KEY,
            therapy_id BIGINT NOT NULL REFERENCES therapies(id),
            author_name TEXT NOT NULL DEFAULT '',
            comment TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
        "CREATE TABLE IF NOT EXISTS telemetry (
            id BIGSERIAL PRIMARY KEY,
            timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            therapy_id BIGINT REFERENCES therapies(id),
            signal_id BIGINT REFERENCES signals(id),
            raw_value BIGINT,
            physical_value TEXT,
            unit TEXT
        )",
        "CREATE TABLE IF NOT EXISTS attribute_equivalences (
            signal_id BIGINT REFERENCES signals(id),
            numeric_value DOUBLE PRECISION,
            display_name TEXT,
            PRIMARY KEY (signal_id, numeric_value)
        )",
        "CREATE TABLE IF NOT EXISTS users (
            id BIGSERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT NOT NULL DEFAULT '',
            email TEXT NOT NULL DEFAULT '',
            role TEXT NOT NULL DEFAULT 'viewer',
            active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    ];

    for stmt in schema_statements {
        sqlx::query(stmt).execute(&pool).await?;
    }

    // Query-performance indexes (safe, idempotent)
    let index_statements = vec![
        "CREATE INDEX IF NOT EXISTS idx_signals_internal_name ON signals(internal_name)",
        "CREATE INDEX IF NOT EXISTS idx_patients_patient_id_str ON patients(patient_id_str)",
        "CREATE INDEX IF NOT EXISTS idx_machines_serial_version ON machines(serial_number, software_version)",
        "CREATE INDEX IF NOT EXISTS idx_therapies_patient_machine ON therapies(patient_id, machine_id, ended_at)",
        "CREATE INDEX IF NOT EXISTS idx_telemetry_therapy_timestamp ON telemetry(therapy_id, timestamp DESC)",
        "CREATE INDEX IF NOT EXISTS idx_telemetry_signal ON telemetry(signal_id)",
        "CREATE INDEX IF NOT EXISTS idx_equiv_signal_numeric ON attribute_equivalences(signal_id, numeric_value)",
        "CREATE INDEX IF NOT EXISTS idx_therapy_comments_therapy ON therapy_comments(therapy_id, created_at)",
    ];

    for stmt in index_statements {
        let _ = sqlx::query(stmt).execute(&pool).await;
    }

    let migration_statements = vec![
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE therapy_comments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ",
        "ALTER TABLE therapy_comments ADD COLUMN IF NOT EXISTS deletion_reason TEXT",
    ];

    for stmt in migration_statements {
        let _ = sqlx::query(stmt).execute(&pool).await;
    }

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
            sqlx::query("INSERT INTO signals (internal_name) VALUES ($1) ON CONFLICT (internal_name) DO NOTHING")
                .bind(eq.internal_name)
                .execute(&mut *tx).await?;
            let row = sqlx::query("SELECT id FROM signals WHERE internal_name = $1")
                .bind(eq.internal_name)
                .fetch_one(&mut *tx).await?;
            let signal_id: i64 = row.get(0);
            sqlx::query(
                "INSERT INTO attribute_equivalences (signal_id, numeric_value, display_name) VALUES ($1, $2, $3)
                 ON CONFLICT (signal_id, numeric_value) DO UPDATE SET display_name = EXCLUDED.display_name"
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
        attr_repo:      DynAttrRepo::Postgres(PgDataAttrRepository::new(pool.clone())),
        dict_repo:      DynDictRepo::Postgres(PgDictionaryRepository::new(pool.clone())),
        telemetry_repo: DynTelemetryRepo::Postgres(PgTelemetryRepository::new(pool.clone())),
        version_repo:   DynVersionRepo::Postgres(PgVersionRepository::new(pool.clone())),
        equiv_repo:     DynEquivRepo::Postgres(PgAttributeEquivalenceRepository::new(pool.clone())),
        db:             Some(DbPool::Postgres(pool)),
    })
}

// ═══════════════════════════════════════════════════════════════
//  MSSQL backend (new)
// ═══════════════════════════════════════════════════════════════

async fn initialize_mssql(settings: &MssqlSettings) -> Result<Repositories, Box<dyn std::error::Error>> {
    println!("  [DB] Connecting to SQL Server...");

    // Keep this aligned with the known-good standalone tiberius sample.
    let mut tib_config = TibConfig::new();
    tib_config.host(settings.host.as_str());
    tib_config.port(settings.port);
    tib_config.database(settings.database.as_str());
    tib_config.authentication(AuthMethod::sql_server(
        settings.username.as_str(),
        settings.password.as_str(),
    ));
    if settings.trust_server_certificate {
        tib_config.trust_cert();
    }

    let mgr = ConnectionManager::new(tib_config);
    let pool = Pool::builder().max_size(8).build(mgr).await?;

    // Create schema (MSSQL uses IF NOT EXISTS via conditional checks)
    {
        let mut conn = pool.get().await?;

        let schema_statements = vec![
            "IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'versions')
             CREATE TABLE versions (
                 id INT IDENTITY(1,1) PRIMARY KEY,
                 created_at DATETIME2 DEFAULT GETUTCDATE(),
                 language_id INT,
                 system_sw NVARCHAR(100), dss_fw NVARCHAR(100), dss_hw NVARCHAR(100),
                 css_fw NVARCHAR(100), css_hw NVARCHAR(100),
                 pss_fw NVARCHAR(100), pss_hw NVARCHAR(100),
                 lang1 NVARCHAR(100), lang2 NVARCHAR(100), lang3 NVARCHAR(100)
             )",
            "IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'signals')
             CREATE TABLE signals (
                 id INT IDENTITY(1,1) PRIMARY KEY,
                 internal_name NVARCHAR(200) UNIQUE
             )",
            "IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'data_attributes')
             CREATE TABLE data_attributes (
                 handle INT PRIMARY KEY,
                 data_type INT, size INT, conversion_factor INT,
                 label_did INT, unit_did INT, signal_id INT,
                 FOREIGN KEY(signal_id) REFERENCES signals(id)
             )",
            "IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'dictionary')
             CREATE TABLE dictionary (
                 dict_id INT PRIMARY KEY,
                 text NVARCHAR(MAX)
             )",
            "IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'patients')
             CREATE TABLE patients (
                 id INT IDENTITY(1,1) PRIMARY KEY,
                 patient_id_str NVARCHAR(200) UNIQUE,
                 created_at DATETIME2 DEFAULT GETUTCDATE(),
                 therapy_start DATETIME2 NULL,
                 therapy_end DATETIME2 NULL
             )",
            "IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'machines')
             CREATE TABLE machines (
                 id INT IDENTITY(1,1) PRIMARY KEY,
                 serial_number NVARCHAR(200) NOT NULL,
                 software_version NVARCHAR(200) NOT NULL,
                 registered_at DATETIME2 DEFAULT GETUTCDATE(),
                 status NVARCHAR(50),
                 CONSTRAINT uq_machines_serial_version UNIQUE (serial_number, software_version)
             )",
            "IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'therapies')
             CREATE TABLE therapies (
                 id INT IDENTITY(1,1) PRIMARY KEY,
                 started_at DATETIME2 DEFAULT GETUTCDATE(),
                 patient_id INT,
                 machine_id INT,
                 status NVARCHAR(50),
                 ended_at DATETIME2 NULL,
                 FOREIGN KEY(patient_id) REFERENCES patients(id),
                 FOREIGN KEY(machine_id) REFERENCES machines(id)
             )",
            "IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'therapy_comments')
             CREATE TABLE therapy_comments (
                 id INT IDENTITY(1,1) PRIMARY KEY,
                 therapy_id INT NOT NULL,
                 author_name NVARCHAR(200) NOT NULL DEFAULT '',
                 comment NVARCHAR(MAX) NOT NULL,
                 created_at DATETIME2 DEFAULT GETUTCDATE(),
                 FOREIGN KEY(therapy_id) REFERENCES therapies(id)
             )",
            "IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'telemetry')
             CREATE TABLE telemetry (
                 id INT IDENTITY(1,1) PRIMARY KEY,
                 timestamp DATETIME2 DEFAULT GETUTCDATE(),
                 therapy_id INT, signal_id INT,
                 raw_value BIGINT, physical_value NVARCHAR(MAX), unit NVARCHAR(100),
                 FOREIGN KEY(therapy_id) REFERENCES therapies(id),
                 FOREIGN KEY(signal_id) REFERENCES signals(id)
             )",
            "IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'attribute_equivalences')
             CREATE TABLE attribute_equivalences (
                 signal_id INT, numeric_value FLOAT, display_name NVARCHAR(500),
                 PRIMARY KEY (signal_id, numeric_value),
                 FOREIGN KEY(signal_id) REFERENCES signals(id)
             )",
            "IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
             CREATE TABLE users (
                 id INT IDENTITY(1,1) PRIMARY KEY,
                 username NVARCHAR(200) UNIQUE NOT NULL,
                 password NVARCHAR(500) NOT NULL,
                 full_name NVARCHAR(500) NOT NULL DEFAULT '',
                 email NVARCHAR(500) NOT NULL DEFAULT '',
                 role NVARCHAR(50) NOT NULL DEFAULT 'viewer',
                 active BIT NOT NULL DEFAULT 1,
                 created_at DATETIME2 DEFAULT GETUTCDATE()
             )",
        ];

        let index_statements = vec![
            "IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_signals_internal_name' AND object_id = OBJECT_ID('signals')) CREATE INDEX idx_signals_internal_name ON signals(internal_name)",
            "IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_patients_patient_id_str' AND object_id = OBJECT_ID('patients')) CREATE INDEX idx_patients_patient_id_str ON patients(patient_id_str)",
            "IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_machines_serial_version' AND object_id = OBJECT_ID('machines')) CREATE INDEX idx_machines_serial_version ON machines(serial_number, software_version)",
            "IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_therapies_patient_machine' AND object_id = OBJECT_ID('therapies')) CREATE INDEX idx_therapies_patient_machine ON therapies(patient_id, machine_id, ended_at)",
            "IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_telemetry_therapy_timestamp' AND object_id = OBJECT_ID('telemetry')) CREATE INDEX idx_telemetry_therapy_timestamp ON telemetry(therapy_id, timestamp DESC)",
            "IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_telemetry_signal' AND object_id = OBJECT_ID('telemetry')) CREATE INDEX idx_telemetry_signal ON telemetry(signal_id)",
            "IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_equiv_signal_numeric' AND object_id = OBJECT_ID('attribute_equivalences')) CREATE INDEX idx_equiv_signal_numeric ON attribute_equivalences(signal_id, numeric_value)",
            "IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_therapy_comments_therapy' AND object_id = OBJECT_ID('therapy_comments')) CREATE INDEX idx_therapy_comments_therapy ON therapy_comments(therapy_id, created_at)",
        ];

        for stmt in schema_statements {
            let q = TibQuery::new(stmt);
            q.execute(&mut *conn).await?;
        }

        for stmt in index_statements {
            let q = TibQuery::new(stmt);
            if let Err(e) = q.execute(&mut *conn).await {
                eprintln!("  [DB] Index warning: {}", e);
            }
        }
        println!("  [DB] SQL Server schema verified.");

        // Schema migrations to update existing tables
        let migration_statements = vec![
            // Convert physical_value from FLOAT to NVARCHAR(MAX) to support string values
            "IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('telemetry') AND name = 'physical_value' AND system_type_id = 62)
             BEGIN
                 ALTER TABLE telemetry ALTER COLUMN physical_value NVARCHAR(MAX);
                 PRINT 'Migrated telemetry.physical_value from FLOAT to NVARCHAR(MAX)';
             END",
            "IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('telemetry') AND name = 'therapy_id')
             BEGIN
                 ALTER TABLE telemetry ADD therapy_id INT NULL;
             END",
            "IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('therapy_comments') AND name = 'deleted_at')
             BEGIN
                 ALTER TABLE therapy_comments ADD deleted_at DATETIME2 NULL;
             END",
            "IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('therapy_comments') AND name = 'deletion_reason')
             BEGIN
                 ALTER TABLE therapy_comments ADD deletion_reason NVARCHAR(MAX) NULL;
             END",
        ];

        for stmt in migration_statements {
            let q = TibQuery::new(stmt);
            if let Err(e) = q.execute(&mut *conn).await {
                // Migration errors are not fatal; log and continue
                eprintln!("  [DB] Migration warning: {}", e);
            }
        }
    }

    // Seed default admin user
    {
        let mut conn = pool.get().await?;
        let q = TibQuery::new("SELECT COUNT(*) FROM users");
        let stream = q.query(&mut *conn).await?;
        let rows: Vec<TibRow> = stream.into_first_result().await?;
        let user_count = rows.first().and_then(|r: &TibRow| r.get::<i32, _>(0)).unwrap_or(0);
        if user_count == 0 {
            let admin_password_hash = hash_password("admin123")
                .map_err(|e| io::Error::other(e.to_string()))?;
            let mut qi = TibQuery::new("INSERT INTO users (username, password, full_name, role) VALUES (@P1, @P2, @P3, @P4)");
            qi.bind("admin"); qi.bind(admin_password_hash.as_str()); qi.bind("Administrator"); qi.bind("admin");
            qi.execute(&mut *conn).await?;
            println!("  [DB] Default admin user created (username: admin, password: admin123)");
        }
    }

    // Seed equivalences
    {
        let mut conn = pool.get().await?;
        let q = TibQuery::new("SELECT COUNT(*) FROM attribute_equivalences");
        let stream = q.query(&mut *conn).await?;
        let rows: Vec<TibRow> = stream.into_first_result().await?;
        let count = rows.first().and_then(|r: &TibRow| r.get::<i32, _>(0)).unwrap_or(0);

        if count == 0 {
            use crate::infrastructure::equivalences_data::EQUIVALENCES;
            for eq in EQUIVALENCES {
                let mut c = pool.get().await?;

                let mut q1 = TibQuery::new("IF NOT EXISTS (SELECT 1 FROM signals WHERE internal_name = @P1) INSERT INTO signals (internal_name) VALUES (@P1)");
                q1.bind(eq.internal_name);
                q1.execute(&mut *c).await?;

                let mut q2 = TibQuery::new("SELECT id FROM signals WHERE internal_name = @P1");
                q2.bind(eq.internal_name);
                let stream = q2.query(&mut *c).await?;
                let rows: Vec<TibRow> = stream.into_first_result().await?;
                let signal_id = rows.first().and_then(|r: &TibRow| r.get::<i32, _>(0)).unwrap_or(0);

                let mut q3 = TibQuery::new(
                    "MERGE attribute_equivalences AS tgt \
                     USING (SELECT @P1 AS signal_id, @P2 AS numeric_value) AS src \
                     ON tgt.signal_id = src.signal_id AND tgt.numeric_value = src.numeric_value \
                     WHEN MATCHED THEN UPDATE SET display_name = @P3 \
                     WHEN NOT MATCHED THEN INSERT (signal_id, numeric_value, display_name) VALUES (@P1, @P2, @P3);"
                );
                q3.bind(signal_id); q3.bind(eq.numeric_value); q3.bind(eq.display_name);
                q3.execute(&mut *c).await?;
            }
            println!("  [DB] Embedded equivalences initialized.");
        }
    }

    Ok(Repositories {
        attr_repo:      DynAttrRepo::Mssql(MssqlDataAttrRepository::new(pool.clone())),
        dict_repo:      DynDictRepo::Mssql(MssqlDictionaryRepository::new(pool.clone())),
        telemetry_repo: DynTelemetryRepo::Mssql(MssqlTelemetryRepository::new(pool.clone())),
        version_repo:   DynVersionRepo::Mssql(MssqlVersionRepository::new(pool.clone())),
        equiv_repo:     DynEquivRepo::Mssql(MssqlAttributeEquivalenceRepository::new(pool.clone())),
        db:             Some(DbPool::Mssql(pool)),
    })
}

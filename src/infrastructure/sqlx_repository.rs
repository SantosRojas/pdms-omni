//! SQLx implementations of all domain repository traits.
//! Supports async execution and can be adapted to AnyPool, PostgresPool, or MssqlPool.

use sqlx::{SqlitePool, Row};

use crate::domain::entities::{
    AttributeEquivalence, DataAttribute, DataType, DictionaryEntry, TelemetryReading, VersionInfo,
};
use crate::domain::repositories::{
    AttributeEquivalenceRepository, DataAttributeRepository, DictionaryRepository, RepositoryError,
    TelemetryRepository, VersionRepository,
};
use crate::infrastructure::persistence_helpers::{
    SQLITE_NUMERIC_EQ_EXPR, build_telemetry_reading, telemetry_value_to_storage,
};

fn map_db_err(e: sqlx::Error) -> RepositoryError {
    RepositoryError::DatabaseError(e.to_string())
}

async fn get_or_create_signal_id(pool: &SqlitePool, name: &str) -> Result<i64, RepositoryError> {
    sqlx::query("INSERT OR IGNORE INTO signals (internal_name) VALUES (?1)")
        .bind(name)
        .execute(pool)
        .await
        .map_err(map_db_err)?;

    let row = sqlx::query("SELECT id FROM signals WHERE internal_name = ?1")
        .bind(name)
        .fetch_one(pool)
        .await
        .map_err(map_db_err)?;
    
    Ok(row.get(0))
}

// ═══════════════════════════════════════════════
//  DataAttributeRepository
// ═══════════════════════════════════════════════
#[derive(Clone)]
pub struct SqlxDataAttrRepository {
    pool: SqlitePool,
}

impl SqlxDataAttrRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

impl DataAttributeRepository for SqlxDataAttrRepository {
    async fn save(&self, attr: &DataAttribute) -> Result<(), RepositoryError> {
        let signal_id = get_or_create_signal_id(&self.pool, &attr.internal_name).await?;
            
        sqlx::query(
            "INSERT OR REPLACE INTO data_attributes (handle, data_type, size, conversion_factor, label_did, unit_did, signal_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
        )
        .bind(attr.handle)
        .bind(attr.data_type as u16)
        .bind(attr.size)
        .bind(attr.conversion_factor)
        .bind(attr.label_did)
        .bind(attr.unit_did)
        .bind(signal_id)
        .execute(&self.pool)
        .await
        .map_err(map_db_err)?;
        Ok(())
    }

    async fn get_all(&self) -> Result<Vec<DataAttribute>, RepositoryError> {
        let rows = sqlx::query(
            "SELECT d.handle, d.data_type, d.size, d.conversion_factor, d.label_did, d.unit_did, d.signal_id, s.internal_name 
             FROM data_attributes d
             JOIN signals s ON d.signal_id = s.id
             ORDER BY d.rowid"
        )
        .fetch_all(&self.pool)
        .await
        .map_err(map_db_err)?;

        Ok(rows.into_iter().map(|row| DataAttribute {
            handle: row.get::<u16, _>(0),
            data_type: DataType::from(row.get::<u16, _>(1)),
            size: row.get::<u16, _>(2),
            conversion_factor: row.get::<u16, _>(3),
            label_did: row.get::<u16, _>(4),
            unit_did: row.get::<u16, _>(5),
            signal_id: row.get::<i64, _>(6),
            internal_name: row.get::<String, _>(7),
        }).collect())
    }

    async fn get_by_handle(&self, handle: u16) -> Result<Option<DataAttribute>, RepositoryError> {
        let row = sqlx::query(
            "SELECT d.handle, d.data_type, d.size, d.conversion_factor, d.label_did, d.unit_did, d.signal_id, s.internal_name 
             FROM data_attributes d
             JOIN signals s ON d.signal_id = s.id
             WHERE d.handle = ?1"
        )
        .bind(handle)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_db_err)?;

        Ok(row.map(|r| DataAttribute {
            handle: r.get(0),
            data_type: DataType::from(r.get::<u16, _>(1)),
            size: r.get(2),
            conversion_factor: r.get(3),
            label_did: r.get(4),
            unit_did: r.get(5),
            signal_id: r.get(6),
            internal_name: r.get(7),
        }))
    }

    async fn delete_all(&self) -> Result<(), RepositoryError> {
        sqlx::query("DELETE FROM data_attributes")
            .execute(&self.pool)
            .await
            .map_err(map_db_err)?;
        Ok(())
    }
}

// ═══════════════════════════════════════════════
//  DictionaryRepository
// ═══════════════════════════════════════════════
#[derive(Clone)]
pub struct SqlxDictionaryRepository {
    pool: SqlitePool,
}

impl SqlxDictionaryRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

impl DictionaryRepository for SqlxDictionaryRepository {
    async fn save(&self, entry: &DictionaryEntry) -> Result<(), RepositoryError> {
        sqlx::query("INSERT OR REPLACE INTO dictionary (dict_id, text) VALUES (?1, ?2)")
            .bind(entry.dict_id)
            .bind(&entry.text)
            .execute(&self.pool)
            .await
            .map_err(map_db_err)?;
        Ok(())
    }

    async fn save_batch(&self, entries: &[DictionaryEntry]) -> Result<(), RepositoryError> {
        if entries.is_empty() {
            return Ok(());
        }

        let mut tx = self.pool.begin().await.map_err(map_db_err)?;
        for entry in entries {
            sqlx::query("INSERT OR REPLACE INTO dictionary (dict_id, text) VALUES (?1, ?2)")
                .bind(entry.dict_id)
                .bind(&entry.text)
                .execute(&mut *tx)
                .await
                .map_err(map_db_err)?;
        }

        tx.commit().await.map_err(map_db_err)?;
        Ok(())
    }

    async fn get_by_id(&self, dict_id: u16) -> Result<Option<DictionaryEntry>, RepositoryError> {
        let row = sqlx::query("SELECT dict_id, text FROM dictionary WHERE dict_id = ?1")
            .bind(dict_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_db_err)?;

        Ok(row.map(|r| DictionaryEntry {
            dict_id: r.get(0),
            text: r.get(1),
        }))
    }

    async fn get_all(&self) -> Result<Vec<DictionaryEntry>, RepositoryError> {
        let rows = sqlx::query("SELECT dict_id, text FROM dictionary ORDER BY dict_id")
            .fetch_all(&self.pool)
            .await
            .map_err(map_db_err)?;

        Ok(rows.into_iter().map(|r| DictionaryEntry {
            dict_id: r.get(0),
            text: r.get(1),
        }).collect())
    }

    async fn delete_all(&self) -> Result<(), RepositoryError> {
        sqlx::query("DELETE FROM dictionary")
            .execute(&self.pool)
            .await
            .map_err(map_db_err)?;
        Ok(())
    }
}

// ═══════════════════════════════════════════════
//  TelemetryRepository
// ═══════════════════════════════════════════════
#[derive(Clone)]
pub struct SqlxTelemetryRepository {
    pool: SqlitePool,
}

impl SqlxTelemetryRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

impl TelemetryRepository for SqlxTelemetryRepository {
    async fn save(&self, reading: &TelemetryReading) -> Result<(), RepositoryError> {
        // SQLite uses dynamic typing, but sqlx forces us to bind a specific rust type. 
        // We can just bind the exact type. To keep it simple, we store numerical as REAL and string as TEXT.
        // Wait, for SQLite, we can just bind both as TEXT or bind the one that has value,
        let physical_value = telemetry_value_to_storage(&reading.physical_value);

        sqlx::query(
            "INSERT INTO telemetry (therapy_id, signal_id, raw_value, physical_value, unit)
             VALUES (?1, ?2, ?3, ?4, ?5)"
        )
        .bind(reading.therapy_id)
        .bind(reading.signal_id)
        .bind(reading.raw_value)
        .bind(physical_value)
        .bind(&reading.unit)
        .execute(&self.pool)
        .await
        .map_err(map_db_err)?;
        Ok(())
    }

    async fn save_batch(&self, readings: &[TelemetryReading]) -> Result<(), RepositoryError> {
        let mut tx = self.pool.begin().await.map_err(map_db_err)?;
        
        for reading in readings {
            let physical_value = telemetry_value_to_storage(&reading.physical_value);
            
            sqlx::query(
                "INSERT INTO telemetry (therapy_id, signal_id, raw_value, physical_value, unit)
                 VALUES (?1, ?2, ?3, ?4, ?5)"
            )
            .bind(reading.therapy_id)
            .bind(reading.signal_id)
            .bind(reading.raw_value)
            .bind(physical_value)
            .bind(&reading.unit)
            .execute(&mut *tx)
            .await
            .map_err(map_db_err)?;
        }
        
        tx.commit().await.map_err(map_db_err)?;
        Ok(())
    }

    async fn get_recent_readings(&self, limit: u32) -> Result<Vec<TelemetryReading>, RepositoryError> {
        let rows = sqlx::query(&format!(
            "SELECT t.id, t.timestamp, t.therapy_id, t.signal_id, s.internal_name, t.raw_value, CAST(t.physical_value AS TEXT), t.unit, e.display_name
             FROM telemetry t
             JOIN signals s ON t.signal_id = s.id
             LEFT JOIN attribute_equivalences e ON s.id = e.signal_id AND {} = e.numeric_value
             ORDER BY t.id DESC LIMIT ?1",
            SQLITE_NUMERIC_EQ_EXPR
        ))
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(map_db_err)?;

        Ok(rows.into_iter().map(|row| {
            build_telemetry_reading(
                Some(row.get(0)),
                row.get(1),
                row.get(2),
                row.get(3),
                row.get(4),
                row.get(5),
                row.get::<String, _>(6),
                row.get(7),
                row.get(8),
            )
        }).collect())
    }

    async fn get_or_create_machine(&self, serial_number: &str, software_version: &str) -> Result<i64, RepositoryError> {
        sqlx::query("INSERT OR IGNORE INTO machines (serial_number, software_version) VALUES (?1, ?2)")
            .bind(serial_number)
            .bind(software_version)
            .execute(&self.pool)
            .await
            .map_err(map_db_err)?;

        let row = sqlx::query("SELECT id FROM machines WHERE serial_number = ?1 AND software_version = ?2")
            .bind(serial_number)
            .bind(software_version)
            .fetch_one(&self.pool)
            .await
            .map_err(map_db_err)?;

        Ok(row.get(0))
    }

    async fn get_or_create_patient(&self, patient_id_str: &str) -> Result<i64, RepositoryError> {
        sqlx::query("INSERT OR IGNORE INTO patients (patient_id_str) VALUES (?1)")
            .bind(patient_id_str)
            .execute(&self.pool)
            .await
            .map_err(map_db_err)?;

        let row = sqlx::query("SELECT id FROM patients WHERE patient_id_str = ?1")
            .bind(patient_id_str)
            .fetch_one(&self.pool)
            .await
            .map_err(map_db_err)?;

        Ok(row.get(0))
    }

    async fn get_or_create_therapy(&self, patient_id: i64, machine_id: i64, started_at: &str, force_new: bool) -> Result<i64, RepositoryError> {
        if force_new {
            sqlx::query("UPDATE therapies SET ended_at = CURRENT_TIMESTAMP, status = 'completed' WHERE patient_id = ?1 AND machine_id = ?2 AND ended_at IS NULL")
                .bind(patient_id)
                .bind(machine_id)
                .execute(&self.pool)
                .await
                .map_err(map_db_err)?;
        } else {
            let existing = sqlx::query_scalar::<_, i64>(
                "SELECT id FROM therapies WHERE patient_id = ?1 AND machine_id = ?2 AND ended_at IS NULL ORDER BY id DESC LIMIT 1"
            )
            .bind(patient_id)
            .bind(machine_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_db_err)?;

            if let Some(id) = existing {
                return Ok(id);
            }
        }

        let row = sqlx::query_scalar::<_, i64>("INSERT INTO therapies (started_at, patient_id, machine_id, status) VALUES (?1, ?2, ?3, 'active') RETURNING id")
            .bind(started_at)
            .bind(patient_id)
            .bind(machine_id)
            .fetch_one(&self.pool)
            .await
            .map_err(map_db_err)?;

        Ok(row)
    }

    async fn get_therapy_history(&self, therapy_id: i64, limit: u32) -> Result<Vec<TelemetryReading>, RepositoryError> {
        let rows = sqlx::query(&format!(
            "SELECT t.id, t.timestamp, t.therapy_id, t.signal_id, s.internal_name, t.raw_value, CAST(t.physical_value AS TEXT), t.unit, e.display_name
             FROM telemetry t
             JOIN therapies th ON t.therapy_id = th.id
             JOIN signals s ON t.signal_id = s.id
             LEFT JOIN attribute_equivalences e ON s.id = e.signal_id AND {} = e.numeric_value
             WHERE th.id = ?1
             ORDER BY t.timestamp DESC LIMIT ?2",
            SQLITE_NUMERIC_EQ_EXPR
        ))
        .bind(therapy_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(map_db_err)?;

        Ok(rows.into_iter().map(|row| {
            build_telemetry_reading(
                Some(row.get(0)),
                row.get(1),
                row.get(2),
                row.get(3),
                row.get(4),
                row.get(5),
                row.get::<String, _>(6),
                row.get(7),
                row.get(8),
            )
        }).collect())
    }

    async fn set_therapy_end(&self, therapy_id: i64) -> Result<(), RepositoryError> {
        sqlx::query("UPDATE therapies SET ended_at = CURRENT_TIMESTAMP, status = 'completed' WHERE id = ?1 AND ended_at IS NULL")
            .bind(therapy_id)
            .execute(&self.pool)
            .await
            .map_err(map_db_err)?;
        Ok(())
    }
}

// ═══════════════════════════════════════════════
//  VersionRepository
// ═══════════════════════════════════════════════
#[derive(Clone)]
pub struct SqlxVersionRepository {
    pool: SqlitePool,
}

impl SqlxVersionRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

impl VersionRepository for SqlxVersionRepository {
    async fn save(&self, version: &VersionInfo) -> Result<(), RepositoryError> {
        sqlx::query(
            "INSERT INTO versions (language_id, system_sw, dss_fw, dss_hw, css_fw, css_hw, pss_fw, pss_hw, lang1, lang2, lang3)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)"
        )
        .bind(version.language_id)
        .bind(&version.system_sw)
        .bind(&version.dss_fw)
        .bind(&version.dss_hw)
        .bind(&version.css_fw)
        .bind(&version.css_hw)
        .bind(&version.pss_fw)
        .bind(&version.pss_hw)
        .bind(&version.language1)
        .bind(&version.language2)
        .bind(&version.language3)
        .execute(&self.pool)
        .await
        .map_err(map_db_err)?;
        Ok(())
    }

    async fn get_latest(&self) -> Result<Option<VersionInfo>, RepositoryError> {
        let row = sqlx::query(
            "SELECT language_id, system_sw, dss_fw, dss_hw, css_fw, css_hw, pss_fw, pss_hw, lang1, lang2, lang3
             FROM versions ORDER BY id DESC LIMIT 1"
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(map_db_err)?;

        Ok(row.map(|r| VersionInfo {
            language_id: r.get(0),
            system_sw: r.get(1),
            dss_fw: r.get(2),
            dss_hw: r.get(3),
            css_fw: r.get(4),
            css_hw: r.get(5),
            pss_fw: r.get(6),
            pss_hw: r.get(7),
            language1: r.get(8),
            language2: r.get(9),
            language3: r.get(10),
        }))
    }
}

// ═══════════════════════════════════════════════
//  AttributeEquivalenceRepository
// ═══════════════════════════════════════════════
#[derive(Clone)]
pub struct SqlxAttributeEquivalenceRepository {
    pool: SqlitePool,
}

impl SqlxAttributeEquivalenceRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

impl AttributeEquivalenceRepository for SqlxAttributeEquivalenceRepository {
    async fn save(&self, equiv: &AttributeEquivalence) -> Result<(), RepositoryError> {
        let signal_id = get_or_create_signal_id(&self.pool, &equiv.internal_name).await?;

        sqlx::query(
            "INSERT OR REPLACE INTO attribute_equivalences (signal_id, numeric_value, display_name)
             VALUES (?1, ?2, ?3)"
        )
        .bind(signal_id)
        .bind(equiv.numeric_value)
        .bind(&equiv.display_name)
        .execute(&self.pool)
        .await
        .map_err(map_db_err)?;
        Ok(())
    }

    async fn save_batch(&self, equivs: &[AttributeEquivalence]) -> Result<(), RepositoryError> {
        let mut tx = self.pool.begin().await.map_err(map_db_err)?;
        for eq in equivs {
            let sig_id_row = sqlx::query("SELECT id FROM signals WHERE internal_name = ?1")
                .bind(&eq.internal_name)
                .fetch_optional(&mut *tx)
                .await
                .map_err(map_db_err)?;
            
            let sig_id: i64 = match sig_id_row {
                Some(r) => r.get(0),
                None => {
                    sqlx::query("INSERT INTO signals (internal_name) VALUES (?1)")
                        .bind(&eq.internal_name)
                        .execute(&mut *tx)
                        .await
                        .map_err(map_db_err)?;
                    let r = sqlx::query("SELECT id FROM signals WHERE internal_name = ?1")
                        .bind(&eq.internal_name)
                        .fetch_one(&mut *tx)
                        .await
                        .map_err(map_db_err)?;
                    r.get(0)
                }
            };

            sqlx::query(
                "INSERT OR REPLACE INTO attribute_equivalences (signal_id, numeric_value, display_name)
                 VALUES (?1, ?2, ?3)"
            )
            .bind(sig_id)
            .bind(eq.numeric_value)
            .bind(&eq.display_name)
            .execute(&mut *tx)
            .await
            .map_err(map_db_err)?;
        }
        tx.commit().await.map_err(map_db_err)?;
        Ok(())
    }

    async fn get_by_internal_name(&self, name: &str) -> Result<Vec<AttributeEquivalence>, RepositoryError> {
        let rows = sqlx::query(
            "SELECT s.internal_name, e.numeric_value, e.display_name 
             FROM attribute_equivalences e
             JOIN signals s ON e.signal_id = s.id
             WHERE s.internal_name = ?1"
        )
        .bind(name)
        .fetch_all(&self.pool)
        .await
        .map_err(map_db_err)?;

        Ok(rows.into_iter().map(|r| AttributeEquivalence {
            internal_name: r.get(0),
            numeric_value: r.get(1),
            display_name: r.get(2),
        }).collect())
    }

    async fn get_all(&self) -> Result<Vec<AttributeEquivalence>, RepositoryError> {
        let rows = sqlx::query(
            "SELECT s.internal_name, e.numeric_value, e.display_name 
             FROM attribute_equivalences e
             JOIN signals s ON e.signal_id = s.id"
        )
        .fetch_all(&self.pool)
        .await
        .map_err(map_db_err)?;

        Ok(rows.into_iter().map(|r| AttributeEquivalence {
            internal_name: r.get(0),
            numeric_value: r.get(1),
            display_name: r.get(2),
        }).collect())
    }
}

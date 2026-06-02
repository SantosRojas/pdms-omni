//! PostgreSQL implementations of all domain repository traits.
//! Mirrors the SQLite SQLx repositories but uses PgPool and PostgreSQL syntax.

use sqlx::{PgPool, Row};

use crate::domain::entities::{
    AttributeEquivalence, DataAttribute, DataType, DictionaryEntry, TelemetryReading, VersionInfo,
};
use crate::domain::repositories::{
    AttributeEquivalenceRepository, DataAttributeRepository, DictionaryRepository, RepositoryError,
    TelemetryRepository, VersionRepository,
};
use crate::infrastructure::persistence_helpers::{
    POSTGRES_NUMERIC_EQ_EXPR, build_telemetry_reading, telemetry_value_to_storage,
};

fn map_db_err(e: sqlx::Error) -> RepositoryError {
    RepositoryError::DatabaseError(e.to_string())
}

async fn get_or_create_signal_id(pool: &PgPool, name: &str) -> Result<i64, RepositoryError> {
    sqlx::query("INSERT INTO signals (internal_name) VALUES ($1) ON CONFLICT (internal_name) DO NOTHING")
        .bind(name)
        .execute(pool)
        .await
        .map_err(map_db_err)?;

    let row = sqlx::query("SELECT id FROM signals WHERE internal_name = $1")
        .bind(name)
        .fetch_one(pool)
        .await
        .map_err(map_db_err)?;

    Ok(row.get(0))
}

// ═══════════════════════════════════════════════
//  DataAttributeRepository
// ═══════════════════════════════════════════════
pub struct PgDataAttrRepository {
    pool: PgPool,
}

impl PgDataAttrRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

impl DataAttributeRepository for PgDataAttrRepository {
    async fn save(&self, attr: &DataAttribute) -> Result<(), RepositoryError> {
        let signal_id = get_or_create_signal_id(&self.pool, &attr.internal_name).await?;

        sqlx::query(
            "INSERT INTO data_attributes (handle, data_type, size, conversion_factor, label_did, unit_did, signal_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (handle) DO UPDATE SET
                 data_type = EXCLUDED.data_type,
                 size = EXCLUDED.size,
                 conversion_factor = EXCLUDED.conversion_factor,
                 label_did = EXCLUDED.label_did,
                 unit_did = EXCLUDED.unit_did,
                 signal_id = EXCLUDED.signal_id"
        )
        .bind(attr.handle as i32)
        .bind(attr.data_type as i32)
        .bind(attr.size as i32)
        .bind(attr.conversion_factor as i32)
        .bind(attr.label_did as i32)
        .bind(attr.unit_did as i32)
        .bind(signal_id as i64)
        .execute(&self.pool)
        .await
        .map_err(map_db_err)?;
        Ok(())
    }

    async fn get_all(&self) -> Result<Vec<DataAttribute>, RepositoryError> {
        let rows = sqlx::query(
            "SELECT d.handle, d.data_type, d.size, d.conversion_factor, d.label_did, d.unit_did, d.signal_id, s.internal_name
             FROM data_attributes d JOIN signals s ON d.signal_id = s.id ORDER BY d.handle"
        )
        .fetch_all(&self.pool)
        .await
        .map_err(map_db_err)?;

        Ok(rows.into_iter().map(|row| DataAttribute {
            handle: row.get::<i32, _>(0) as u16,
            data_type: DataType::from(row.get::<i32, _>(1) as u16),
            size: row.get::<i32, _>(2) as u16,
            conversion_factor: row.get::<i32, _>(3) as u16,
            label_did: row.get::<i32, _>(4) as u16,
            unit_did: row.get::<i32, _>(5) as u16,
            signal_id: row.get::<i64, _>(6),
            internal_name: row.get::<String, _>(7),
        }).collect())
    }

    async fn get_by_handle(&self, handle: u16) -> Result<Option<DataAttribute>, RepositoryError> {
        let row = sqlx::query(
            "SELECT d.handle, d.data_type, d.size, d.conversion_factor, d.label_did, d.unit_did, d.signal_id, s.internal_name
             FROM data_attributes d JOIN signals s ON d.signal_id = s.id WHERE d.handle = $1"
        )
        .bind(handle as i32)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_db_err)?;

        Ok(row.map(|r| DataAttribute {
            handle: r.get::<i32, _>(0) as u16,
            data_type: DataType::from(r.get::<i32, _>(1) as u16),
            size: r.get::<i32, _>(2) as u16,
            conversion_factor: r.get::<i32, _>(3) as u16,
            label_did: r.get::<i32, _>(4) as u16,
            unit_did: r.get::<i32, _>(5) as u16,
            signal_id: r.get::<i64, _>(6),
            internal_name: r.get::<String, _>(7),
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
pub struct PgDictionaryRepository {
    pool: PgPool,
}

impl PgDictionaryRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

impl DictionaryRepository for PgDictionaryRepository {
    async fn save(&self, entry: &DictionaryEntry) -> Result<(), RepositoryError> {
        sqlx::query(
            "INSERT INTO dictionary (dict_id, text) VALUES ($1, $2)
             ON CONFLICT (dict_id) DO UPDATE SET text = EXCLUDED.text"
        )
        .bind(entry.dict_id as i32)
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
            sqlx::query(
                "INSERT INTO dictionary (dict_id, text) VALUES ($1, $2)
                 ON CONFLICT (dict_id) DO UPDATE SET text = EXCLUDED.text"
            )
            .bind(entry.dict_id as i32)
            .bind(&entry.text)
            .execute(&mut *tx)
            .await
            .map_err(map_db_err)?;
        }

        tx.commit().await.map_err(map_db_err)?;
        Ok(())
    }

    async fn get_by_id(&self, dict_id: u16) -> Result<Option<DictionaryEntry>, RepositoryError> {
        let row = sqlx::query("SELECT dict_id, text FROM dictionary WHERE dict_id = $1")
            .bind(dict_id as i32)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_db_err)?;

        Ok(row.map(|r| DictionaryEntry {
            dict_id: r.get::<i32, _>(0) as u16,
            text: r.get::<String, _>(1),
        }))
    }

    async fn get_all(&self) -> Result<Vec<DictionaryEntry>, RepositoryError> {
        let rows = sqlx::query("SELECT dict_id, text FROM dictionary ORDER BY dict_id")
            .fetch_all(&self.pool)
            .await
            .map_err(map_db_err)?;

        Ok(rows.into_iter().map(|r| DictionaryEntry {
            dict_id: r.get::<i32, _>(0) as u16,
            text: r.get::<String, _>(1),
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
pub struct PgTelemetryRepository {
    pool: PgPool,
}

impl PgTelemetryRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

impl TelemetryRepository for PgTelemetryRepository {
    async fn save(&self, reading: &TelemetryReading) -> Result<(), RepositoryError> {
        let physical_value = telemetry_value_to_storage(&reading.physical_value);

        sqlx::query(
            "INSERT INTO telemetry (therapy_id, signal_id, raw_value, physical_value, unit)
             VALUES ($1, $2, $3, $4, $5)"
        )
        .bind(reading.therapy_id.map(|v| v as i64))
        .bind(reading.signal_id as i64)
        .bind(reading.raw_value)
        .bind(physical_value)
        .bind(&reading.unit)
        .execute(&self.pool)
        .await
        .map_err(map_db_err)?;
        Ok(())
    }

    async fn save_batch(&self, readings: &[TelemetryReading]) -> Result<(), RepositoryError> {
        if readings.is_empty() {
            return Ok(());
        }

        let mut tx = self.pool.begin().await.map_err(map_db_err)?;
        for reading in readings {
            let physical_value = telemetry_value_to_storage(&reading.physical_value);
            sqlx::query(
                "INSERT INTO telemetry (therapy_id, signal_id, raw_value, physical_value, unit)
                 VALUES ($1, $2, $3, $4, $5)"
            )
            .bind(reading.therapy_id.map(|v| v as i64))
            .bind(reading.signal_id as i64)
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
                "SELECT t.id, TO_CHAR(t.timestamp, 'YYYY-MM-DD HH24:MI:SS'), t.therapy_id, t.signal_id, s.internal_name,
                    t.raw_value, CAST(t.physical_value AS TEXT), t.unit, e.display_name
             FROM telemetry t
             JOIN signals s ON t.signal_id = s.id
             LEFT JOIN attribute_equivalences e
               ON s.id = e.signal_id AND {} = e.numeric_value
             ORDER BY t.id DESC LIMIT $1",
            POSTGRES_NUMERIC_EQ_EXPR
        ))
        .bind(limit as i64)
        .fetch_all(&self.pool)
        .await
        .map_err(map_db_err)?;

        Ok(rows.into_iter().map(|row| {
            build_telemetry_reading(
                Some(row.get::<i64, _>(0)),
                row.get::<String, _>(1),
                row.get::<Option<i64>, _>(2),
                row.get::<i64, _>(3),
                row.get::<String, _>(4),
                row.get::<i64, _>(5),
                row.get::<String, _>(6),
                row.get::<String, _>(7),
                row.get::<Option<String>, _>(8),
            )
        }).collect())
    }

    async fn get_or_create_machine(&self, serial_number: &str, software_version: &str) -> Result<i64, RepositoryError> {
        sqlx::query("INSERT INTO machines (serial_number, software_version) VALUES ($1, $2) ON CONFLICT (serial_number, software_version) DO NOTHING")
            .bind(serial_number)
            .bind(software_version)
            .execute(&self.pool)
            .await
            .map_err(map_db_err)?;

        let row = sqlx::query("SELECT id FROM machines WHERE serial_number = $1 AND software_version = $2")
            .bind(serial_number)
            .bind(software_version)
            .fetch_one(&self.pool)
            .await
            .map_err(map_db_err)?;

        Ok(row.get(0))
    }

    async fn get_or_create_patient(&self, patient_id_str: &str) -> Result<i64, RepositoryError> {
        sqlx::query("INSERT INTO patients (patient_id_str) VALUES ($1) ON CONFLICT (patient_id_str) DO NOTHING")
            .bind(patient_id_str)
            .execute(&self.pool)
            .await
            .map_err(map_db_err)?;

        let row = sqlx::query("SELECT id FROM patients WHERE patient_id_str = $1")
            .bind(patient_id_str)
            .fetch_one(&self.pool)
            .await
            .map_err(map_db_err)?;

        Ok(row.get::<i64, _>(0))
    }

    async fn get_or_create_therapy(&self, patient_id: i64, machine_id: i64, started_at: &str) -> Result<i64, RepositoryError> {
        let row = sqlx::query_scalar::<_, i64>("INSERT INTO therapies (started_at, patient_id, machine_id, status) VALUES ($1, $2, $3, 'active') RETURNING id")
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
            "SELECT t.id, TO_CHAR(t.timestamp, 'YYYY-MM-DD HH24:MI:SS'), t.therapy_id, t.signal_id, s.internal_name,
                    t.raw_value, CAST(t.physical_value AS TEXT), t.unit, e.display_name
             FROM telemetry t
             JOIN therapies th ON t.therapy_id = th.id
             JOIN signals s ON t.signal_id = s.id
             LEFT JOIN attribute_equivalences e
               ON s.id = e.signal_id AND {} = e.numeric_value
             WHERE th.id = $1
             ORDER BY t.timestamp DESC LIMIT $2",
            POSTGRES_NUMERIC_EQ_EXPR
        ))
        .bind(therapy_id)
        .bind(limit as i64)
        .fetch_all(&self.pool)
        .await
        .map_err(map_db_err)?;

        Ok(rows.into_iter().map(|row| {
            build_telemetry_reading(
                Some(row.get::<i64, _>(0)),
                row.get::<String, _>(1),
                row.get::<Option<i64>, _>(2),
                row.get::<i64, _>(3),
                row.get::<String, _>(4),
                row.get::<i64, _>(5),
                row.get::<String, _>(6),
                row.get::<String, _>(7),
                row.get::<Option<String>, _>(8),
            )
        }).collect())
    }

    async fn set_therapy_end(&self, therapy_id: i64) -> Result<(), RepositoryError> {
        sqlx::query("UPDATE therapies SET ended_at = CURRENT_TIMESTAMP, status = 'completed' WHERE id = $1 AND ended_at IS NULL")
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
pub struct PgVersionRepository {
    pool: PgPool,
}

impl PgVersionRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

impl VersionRepository for PgVersionRepository {
    async fn save(&self, version: &VersionInfo) -> Result<(), RepositoryError> {
        sqlx::query::<sqlx::Postgres>(
            "INSERT INTO versions (language_id, system_sw, dss_fw, dss_hw, css_fw, css_hw, pss_fw, pss_hw, lang1, lang2, lang3)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)"
        )
        .bind(version.language_id as i32)
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
        let row = sqlx::query::<sqlx::Postgres>(
            "SELECT language_id, system_sw, dss_fw, dss_hw, css_fw, css_hw, pss_fw, pss_hw, lang1, lang2, lang3
             FROM versions ORDER BY id DESC LIMIT 1"
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(map_db_err)?;

        Ok(row.map(|r| VersionInfo {
            language_id: r.get::<i32, _>(0) as u16,
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
pub struct PgAttributeEquivalenceRepository {
    pool: PgPool,
}

impl PgAttributeEquivalenceRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

impl AttributeEquivalenceRepository for PgAttributeEquivalenceRepository {
    async fn save(&self, equiv: &AttributeEquivalence) -> Result<(), RepositoryError> {
        let signal_id = get_or_create_signal_id(&self.pool, &equiv.internal_name).await?;

        sqlx::query::<sqlx::Postgres>(
            "INSERT INTO attribute_equivalences (signal_id, numeric_value, display_name)
             VALUES ($1, $2, $3)
             ON CONFLICT (signal_id, numeric_value) DO UPDATE SET display_name = EXCLUDED.display_name"
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
        for eq in equivs {
            self.save(eq).await?;
        }
        Ok(())
    }

    async fn get_by_internal_name(&self, name: &str) -> Result<Vec<AttributeEquivalence>, RepositoryError> {
        let rows = sqlx::query(
            "SELECT s.internal_name, e.numeric_value, e.display_name
             FROM attribute_equivalences e
             JOIN signals s ON e.signal_id = s.id
             WHERE s.internal_name = $1"
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
//! MSSQL (SQL Server) implementations of all domain repository traits.
//! Uses tiberius + bb8 for async pooled connections.
//! All queries use tiberius::Query with .bind() to handle mixed parameter types.

use bb8::Pool;
use bb8_tiberius::ConnectionManager;
use tiberius::{Row, Query};

use crate::domain::entities::{
    AttributeEquivalence, DataAttribute, DataType, DictionaryEntry, TelemetryReading, VersionInfo,
};
use crate::domain::repositories::{
    AttributeEquivalenceRepository, DataAttributeRepository, DictionaryRepository, RepositoryError,
    TelemetryRepository, VersionRepository,
};
use crate::infrastructure::persistence_helpers::{
    MSSQL_NUMERIC_EQ_EXPR, build_telemetry_reading, telemetry_value_to_storage,
};

fn map_db_err(e: impl std::fmt::Display) -> RepositoryError {
    RepositoryError::DatabaseError(e.to_string())
}

async fn get_or_create_signal_id(pool: &Pool<ConnectionManager>, name: &str) -> Result<i64, RepositoryError> {
    let mut conn = pool.get().await.map_err(map_db_err)?;

    let mut q = Query::new("IF NOT EXISTS (SELECT 1 FROM signals WHERE internal_name = @P1) INSERT INTO signals (internal_name) VALUES (@P1)");
    q.bind(name);
    q.execute(&mut *conn).await.map_err(map_db_err)?;

    let mut q2 = Query::new("SELECT id FROM signals WHERE internal_name = @P1");
    q2.bind(name);
    let stream = q2.query(&mut *conn).await.map_err(map_db_err)?;
    let rows: Vec<Row> = stream.into_first_result().await.map_err(map_db_err)?;

    let id = rows.first()
        .and_then(|r: &Row| r.get::<i32, _>(0))
        .ok_or_else(|| RepositoryError::DatabaseError("Signal not created".into()))?;

    Ok(id as i64)
}

// ═══════════════════════════════════════════════
//  DataAttributeRepository
// ═══════════════════════════════════════════════
#[derive(Clone)]
pub struct MssqlDataAttrRepository {
    pool: Pool<ConnectionManager>,
}

impl MssqlDataAttrRepository {
    pub fn new(pool: Pool<ConnectionManager>) -> Self {
        Self { pool }
    }
}

impl DataAttributeRepository for MssqlDataAttrRepository {
    async fn save(&self, attr: &DataAttribute) -> Result<(), RepositoryError> {
        let signal_id = get_or_create_signal_id(&self.pool, &attr.internal_name).await?;

        let mut conn = self.pool.get().await.map_err(map_db_err)?;
        let mut q = Query::new(
            "MERGE data_attributes AS tgt \
             USING (SELECT @P1 AS handle) AS src ON tgt.handle = src.handle \
             WHEN MATCHED THEN UPDATE SET data_type=@P2, size=@P3, conversion_factor=@P4, label_did=@P5, unit_did=@P6, signal_id=@P7 \
             WHEN NOT MATCHED THEN INSERT (handle, data_type, size, conversion_factor, label_did, unit_did, signal_id) VALUES (@P1,@P2,@P3,@P4,@P5,@P6,@P7);"
        );
        q.bind(attr.handle as i32);
        q.bind(attr.data_type as i32);
        q.bind(attr.size as i32);
        q.bind(attr.conversion_factor as i32);
        q.bind(attr.label_did as i32);
        q.bind(attr.unit_did as i32);
        q.bind(signal_id as i32);
        q.execute(&mut *conn).await.map_err(map_db_err)?;
        Ok(())
    }

    async fn get_all(&self) -> Result<Vec<DataAttribute>, RepositoryError> {
        let mut conn = self.pool.get().await.map_err(map_db_err)?;
        let q = Query::new(
            "SELECT d.handle, d.data_type, d.size, d.conversion_factor, d.label_did, d.unit_did, d.signal_id, s.internal_name \
             FROM data_attributes d JOIN signals s ON d.signal_id = s.id ORDER BY d.handle"
        );
        let stream = q.query(&mut *conn).await.map_err(map_db_err)?;
        let rows: Vec<Row> = stream.into_first_result().await.map_err(map_db_err)?;

        Ok(rows.into_iter().map(|row: Row| DataAttribute {
            handle: row.get::<i32, _>(0).unwrap_or(0) as u16,
            data_type: DataType::from(row.get::<i32, _>(1).unwrap_or(255) as u16),
            size: row.get::<i32, _>(2).unwrap_or(0) as u16,
            conversion_factor: row.get::<i32, _>(3).unwrap_or(0) as u16,
            label_did: row.get::<i32, _>(4).unwrap_or(0) as u16,
            unit_did: row.get::<i32, _>(5).unwrap_or(0) as u16,
            signal_id: row.get::<i32, _>(6).unwrap_or(0) as i64,
            internal_name: row.get::<&str, _>(7).unwrap_or("").to_string(),
        }).collect())
    }

    async fn get_by_handle(&self, handle: u16) -> Result<Option<DataAttribute>, RepositoryError> {
        let mut conn = self.pool.get().await.map_err(map_db_err)?;
        let mut q = Query::new(
            "SELECT d.handle, d.data_type, d.size, d.conversion_factor, d.label_did, d.unit_did, d.signal_id, s.internal_name \
             FROM data_attributes d JOIN signals s ON d.signal_id = s.id WHERE d.handle = @P1"
        );
        q.bind(handle as i32);
        let stream = q.query(&mut *conn).await.map_err(map_db_err)?;
        let rows: Vec<Row> = stream.into_first_result().await.map_err(map_db_err)?;

        Ok(rows.into_iter().next().map(|r: Row| DataAttribute {
            handle: r.get::<i32, _>(0).unwrap_or(0) as u16,
            data_type: DataType::from(r.get::<i32, _>(1).unwrap_or(255) as u16),
            size: r.get::<i32, _>(2).unwrap_or(0) as u16,
            conversion_factor: r.get::<i32, _>(3).unwrap_or(0) as u16,
            label_did: r.get::<i32, _>(4).unwrap_or(0) as u16,
            unit_did: r.get::<i32, _>(5).unwrap_or(0) as u16,
            signal_id: r.get::<i32, _>(6).unwrap_or(0) as i64,
            internal_name: r.get::<&str, _>(7).unwrap_or("").to_string(),
        }))
    }

    async fn delete_all(&self) -> Result<(), RepositoryError> {
        let mut conn = self.pool.get().await.map_err(map_db_err)?;
        let q = Query::new("DELETE FROM data_attributes");
        q.execute(&mut *conn).await.map_err(map_db_err)?;
        Ok(())
    }
}

// ═══════════════════════════════════════════════
//  DictionaryRepository
// ═══════════════════════════════════════════════
#[derive(Clone)]
pub struct MssqlDictionaryRepository {
    pool: Pool<ConnectionManager>,
}

impl MssqlDictionaryRepository {
    pub fn new(pool: Pool<ConnectionManager>) -> Self {
        Self { pool }
    }
}

impl DictionaryRepository for MssqlDictionaryRepository {
    async fn save(&self, entry: &DictionaryEntry) -> Result<(), RepositoryError> {
        let mut conn = self.pool.get().await.map_err(map_db_err)?;
        let mut q = Query::new(
            "MERGE dictionary AS tgt USING (SELECT @P1 AS dict_id) AS src ON tgt.dict_id = src.dict_id \
             WHEN MATCHED THEN UPDATE SET text = @P2 \
             WHEN NOT MATCHED THEN INSERT (dict_id, text) VALUES (@P1, @P2);"
        );
        q.bind(entry.dict_id as i32);
        q.bind(entry.text.as_str());
        q.execute(&mut *conn).await.map_err(map_db_err)?;
        Ok(())
    }

    async fn save_batch(&self, entries: &[DictionaryEntry]) -> Result<(), RepositoryError> {
        if entries.is_empty() {
            return Ok(());
        }

        let mut conn = self.pool.get().await.map_err(map_db_err)?;
        for entry in entries {
            let mut q = Query::new(
                "MERGE dictionary AS tgt USING (SELECT @P1 AS dict_id) AS src ON tgt.dict_id = src.dict_id \
                 WHEN MATCHED THEN UPDATE SET text = @P2 \
                 WHEN NOT MATCHED THEN INSERT (dict_id, text) VALUES (@P1, @P2);"
            );
            q.bind(entry.dict_id as i32);
            q.bind(entry.text.as_str());
            q.execute(&mut *conn).await.map_err(map_db_err)?;
        }

        Ok(())
    }

    async fn get_by_id(&self, dict_id: u16) -> Result<Option<DictionaryEntry>, RepositoryError> {
        let mut conn = self.pool.get().await.map_err(map_db_err)?;
        let mut q = Query::new("SELECT dict_id, text FROM dictionary WHERE dict_id = @P1");
        q.bind(dict_id as i32);
        let stream = q.query(&mut *conn).await.map_err(map_db_err)?;
        let rows: Vec<Row> = stream.into_first_result().await.map_err(map_db_err)?;

        Ok(rows.into_iter().next().map(|r: Row| DictionaryEntry {
            dict_id: r.get::<i32, _>(0).unwrap_or(0) as u16,
            text: r.get::<&str, _>(1).unwrap_or("").to_string(),
        }))
    }

    async fn get_all(&self) -> Result<Vec<DictionaryEntry>, RepositoryError> {
        let mut conn = self.pool.get().await.map_err(map_db_err)?;
        let q = Query::new("SELECT dict_id, text FROM dictionary ORDER BY dict_id");
        let stream = q.query(&mut *conn).await.map_err(map_db_err)?;
        let rows: Vec<Row> = stream.into_first_result().await.map_err(map_db_err)?;

        Ok(rows.into_iter().map(|r: Row| DictionaryEntry {
            dict_id: r.get::<i32, _>(0).unwrap_or(0) as u16,
            text: r.get::<&str, _>(1).unwrap_or("").to_string(),
        }).collect())
    }

    async fn delete_all(&self) -> Result<(), RepositoryError> {
        let mut conn = self.pool.get().await.map_err(map_db_err)?;
        let q = Query::new("DELETE FROM dictionary");
        q.execute(&mut *conn).await.map_err(map_db_err)?;
        Ok(())
    }
}

// ═══════════════════════════════════════════════
//  TelemetryRepository
// ═══════════════════════════════════════════════
#[derive(Clone)]
pub struct MssqlTelemetryRepository {
    pool: Pool<ConnectionManager>,
}

impl MssqlTelemetryRepository {
    pub fn new(pool: Pool<ConnectionManager>) -> Self {
        Self { pool }
    }
}

impl TelemetryRepository for MssqlTelemetryRepository {
    async fn save(&self, reading: &TelemetryReading) -> Result<(), RepositoryError> {
        let physical_value = telemetry_value_to_storage(&reading.physical_value);

        let mut conn = self.pool.get().await.map_err(map_db_err)?;
        let mut q = Query::new(
            "INSERT INTO telemetry (therapy_id, signal_id, raw_value, physical_value, unit) VALUES (@P1, @P2, @P3, @P4, @P5)"
        );
        q.bind(reading.therapy_id.map(|v| v as i32));
        q.bind(reading.signal_id as i32);
        q.bind(reading.raw_value);
        q.bind(physical_value.as_str());
        q.bind(reading.unit.as_str());
        q.execute(&mut *conn).await.map_err(map_db_err)?;
        Ok(())
    }

    async fn save_batch(&self, readings: &[TelemetryReading]) -> Result<(), RepositoryError> {
        if readings.is_empty() {
            return Ok(());
        }

        let mut conn = self.pool.get().await.map_err(map_db_err)?;
        for reading in readings {
            let physical_value = telemetry_value_to_storage(&reading.physical_value);
            let mut q = Query::new(
                "INSERT INTO telemetry (therapy_id, signal_id, raw_value, physical_value, unit) VALUES (@P1, @P2, @P3, @P4, @P5)"
            );
            q.bind(reading.therapy_id.map(|v| v as i32));
            q.bind(reading.signal_id as i32);
            q.bind(reading.raw_value);
            q.bind(physical_value.as_str());
            q.bind(reading.unit.as_str());
            q.execute(&mut *conn).await.map_err(map_db_err)?;
        }
        Ok(())
    }

    async fn get_recent_readings(&self, limit: u32) -> Result<Vec<TelemetryReading>, RepositoryError> {
        let mut conn = self.pool.get().await.map_err(map_db_err)?;
        let query = format!(
            "SELECT TOP(@P1) t.id, CONVERT(NVARCHAR(30), t.timestamp, 120), t.therapy_id, t.signal_id, s.internal_name, \
                t.raw_value, CAST(t.physical_value AS NVARCHAR(MAX)), t.unit, e.display_name \
             FROM telemetry t \
             JOIN signals s ON t.signal_id = s.id \
             LEFT JOIN attribute_equivalences e ON s.id = e.signal_id AND {} = e.numeric_value \
             ORDER BY t.id DESC",
             MSSQL_NUMERIC_EQ_EXPR
        );
        let mut q = Query::new(query);
        q.bind(limit as i32);
        let stream = q.query(&mut *conn).await.map_err(map_db_err)?;
        let rows: Vec<Row> = stream.into_first_result().await.map_err(map_db_err)?;

        Ok(rows.into_iter().map(|row: Row| {
            build_telemetry_reading(
                row.get::<i32, _>(0).map(|v| v as i64),
                row.get::<&str, _>(1).unwrap_or("").to_string(),
                row.get::<i32, _>(2).map(|v| v as i64),
                row.get::<i32, _>(3).unwrap_or(0) as i64,
                row.get::<&str, _>(4).unwrap_or("").to_string(),
                row.get::<i64, _>(5).unwrap_or(0),
                row.get::<&str, _>(6).unwrap_or("0").to_string(),
                row.get::<&str, _>(7).unwrap_or("").to_string(),
                row.get::<&str, _>(8).map(|v: &str| v.to_string()),
                None,
            )
        }).collect())
    }

    async fn get_or_create_machine(&self, serial_number: &str, software_version: &str) -> Result<i64, RepositoryError> {
        let mut conn = self.pool.get().await.map_err(map_db_err)?;

        let mut q1 = Query::new(
            "IF NOT EXISTS (SELECT 1 FROM machines WHERE serial_number = @P1 AND software_version = @P2) INSERT INTO machines (serial_number, software_version) VALUES (@P1, @P2)"
        );
        q1.bind(serial_number);
        q1.bind(software_version);
        q1.execute(&mut *conn).await.map_err(map_db_err)?;

        let mut q2 = Query::new("SELECT id FROM machines WHERE serial_number = @P1 AND software_version = @P2");
        q2.bind(serial_number);
        q2.bind(software_version);
        let stream = q2.query(&mut *conn).await.map_err(map_db_err)?;
        let rows: Vec<Row> = stream.into_first_result().await.map_err(map_db_err)?;
        let id = rows.first().and_then(|r: &Row| r.get::<i32, _>(0)).ok_or_else(|| RepositoryError::DatabaseError("Machine not found after insert".into()))?;
        Ok(id as i64)
    }

    async fn get_or_create_patient(&self, patient_id_str: &str) -> Result<i64, RepositoryError> {
        let mut conn = self.pool.get().await.map_err(map_db_err)?;

        let mut q1 = Query::new(
            "IF NOT EXISTS (SELECT 1 FROM patients WHERE patient_id_str = @P1) INSERT INTO patients (patient_id_str) VALUES (@P1)"
        );
        q1.bind(patient_id_str);
        q1.execute(&mut *conn).await.map_err(map_db_err)?;

        let mut q2 = Query::new("SELECT id FROM patients WHERE patient_id_str = @P1");
        q2.bind(patient_id_str);
        let stream = q2.query(&mut *conn).await.map_err(map_db_err)?;
        let rows: Vec<Row> = stream.into_first_result().await.map_err(map_db_err)?;

        let id = rows.first()
            .and_then(|r: &Row| r.get::<i32, _>(0))
            .ok_or_else(|| RepositoryError::DatabaseError("Patient not found after insert".into()))?;

        Ok(id as i64)
    }

    async fn get_or_create_therapy(&self, patient_id: i64, machine_id: i64, started_at: &str, force_new: bool, serial_session_id: Option<i64>) -> Result<i64, RepositoryError> {
        let mut conn = self.pool.get().await.map_err(map_db_err)?;

        if force_new {
            let mut q_update = Query::new("UPDATE therapies SET ended_at = GETUTCDATE(), status = 'completed' WHERE patient_id = @P1 AND machine_id = @P2 AND ended_at IS NULL");
            q_update.bind(patient_id as i32);
            q_update.bind(machine_id as i32);
            q_update.execute(&mut *conn).await.map_err(map_db_err)?;
        } else {
            let mut q_select = Query::new("SELECT TOP(1) id FROM therapies WHERE patient_id = @P1 AND machine_id = @P2 AND ended_at IS NULL ORDER BY id DESC");
            q_select.bind(patient_id as i32);
            q_select.bind(machine_id as i32);
            let stream = q_select.query(&mut *conn).await.map_err(map_db_err)?;
            let rows: Vec<Row> = stream.into_first_result().await.map_err(map_db_err)?;
            if let Some(r) = rows.first() {
                if let Some(id) = r.get::<i32, _>(0) {
                    return Ok(id as i64);
                }
            }
        }

        let mut q_insert = Query::new("INSERT INTO therapies (started_at, patient_id, machine_id, status, serial_session_id) OUTPUT INSERTED.id VALUES (@P1, @P2, @P3, 'active', @P4)");
        q_insert.bind(started_at);
        q_insert.bind(patient_id as i32);
        q_insert.bind(machine_id as i32);
        q_insert.bind(serial_session_id.map(|v| v as i32));
        let stream = q_insert.query(&mut *conn).await.map_err(map_db_err)?;
        let rows: Vec<Row> = stream.into_first_result().await.map_err(map_db_err)?;
        let id = rows.first().and_then(|r: &Row| r.get::<i32, _>(0)).ok_or_else(|| RepositoryError::DatabaseError("Therapy not created".into()))?;
        Ok(id as i64)
    }

    async fn get_therapy_history(&self, therapy_id: i64, limit: u32) -> Result<Vec<TelemetryReading>, RepositoryError> {
        let mut conn = self.pool.get().await.map_err(map_db_err)?;
        let query = format!(
            "SELECT TOP(@P1) t.id, CONVERT(NVARCHAR(30), t.timestamp, 120), t.therapy_id, t.signal_id, s.internal_name, \
                t.raw_value, CAST(t.physical_value AS NVARCHAR(MAX)), t.unit, e.display_name \
             FROM telemetry t \
             JOIN therapies th ON t.therapy_id = th.id \
             JOIN signals s ON t.signal_id = s.id \
             LEFT JOIN attribute_equivalences e ON s.id = e.signal_id AND {} = e.numeric_value \
             WHERE th.id = @P2 \
             ORDER BY t.timestamp DESC",
             MSSQL_NUMERIC_EQ_EXPR
        );
        let mut q = Query::new(query);
        q.bind(limit as i32);
        q.bind(therapy_id as i32);
        let stream = q.query(&mut *conn).await.map_err(map_db_err)?;
        let rows: Vec<Row> = stream.into_first_result().await.map_err(map_db_err)?;

        Ok(rows.into_iter().map(|row: Row| {
            build_telemetry_reading(
                row.get::<i32, _>(0).map(|v| v as i64),
                row.get::<&str, _>(1).unwrap_or("").to_string(),
                row.get::<i32, _>(2).map(|v| v as i64),
                row.get::<i32, _>(3).unwrap_or(0) as i64,
                row.get::<&str, _>(4).unwrap_or("").to_string(),
                row.get::<i64, _>(5).unwrap_or(0),
                row.get::<&str, _>(6).unwrap_or("0").to_string(),
                row.get::<&str, _>(7).unwrap_or("").to_string(),
                row.get::<&str, _>(8).map(|v: &str| v.to_string()),
                None,
            )
        }).collect())
    }

    async fn set_therapy_end(&self, therapy_id: i64) -> Result<(), RepositoryError> {
        let mut conn = self.pool.get().await.map_err(map_db_err)?;
        let mut q = Query::new("UPDATE therapies SET ended_at = GETUTCDATE(), status = 'completed' WHERE id = @P1 AND ended_at IS NULL");
        q.bind(therapy_id as i32);
        q.execute(&mut *conn).await.map_err(map_db_err)?;
        Ok(())
    }

    async fn create_serial_session(&self, machine_id: i64, patient_id_str: &str) -> Result<i64, RepositoryError> {
        let mut conn = self.pool.get().await.map_err(map_db_err)?;
        let mut qi = Query::new("INSERT INTO serial_sessions (machine_id, patient_id_str) OUTPUT INSERTED.id VALUES (@P1, @P2)");
        qi.bind(machine_id as i32);
        qi.bind(patient_id_str);
        let stream = qi.query(&mut *conn).await.map_err(map_db_err)?;
        let rows: Vec<Row> = stream.into_first_result().await.map_err(map_db_err)?;
        let id = rows.first().and_then(|r: &Row| r.get::<i32, _>(0)).unwrap_or(0);
        Ok(id as i64)
    }

    async fn end_serial_session(&self, session_id: i64) -> Result<(), RepositoryError> {
        let mut conn = self.pool.get().await.map_err(map_db_err)?;
        let mut q = Query::new("UPDATE serial_sessions SET ended_at = GETUTCDATE(), status = 'completed' WHERE id = @P1 AND ended_at IS NULL");
        q.bind(session_id as i32);
        q.execute(&mut *conn).await.map_err(map_db_err)?;
        Ok(())
    }

    async fn save_session_readings(&self, session_id: i64, readings: &[TelemetryReading], phase: &str) -> Result<(), RepositoryError> {
        let mut conn = self.pool.get().await.map_err(map_db_err)?;
        for reading in readings {
            let physical_value = telemetry_value_to_storage(&reading.physical_value);
            let mut q = Query::new(
                "INSERT INTO session_readings (serial_session_id, signal_id, raw_value, physical_value, unit, display_value, phase)
                 VALUES (@P1, @P2, @P3, @P4, @P5, @P6, @P7)"
            );
            q.bind(session_id as i32);
            q.bind(reading.signal_id as i32);
            q.bind(reading.raw_value);
            q.bind(physical_value.as_str());
            q.bind(reading.unit.as_str());
            q.bind(reading.display_value.as_deref().unwrap_or(""));
            q.bind(phase);
            q.execute(&mut *conn).await.map_err(map_db_err)?;
        }
        Ok(())
    }

    async fn get_session_readings(&self, session_id: i64, limit: u32) -> Result<Vec<TelemetryReading>, RepositoryError> {
        let mut conn = self.pool.get().await.map_err(map_db_err)?;
        let query = "SELECT TOP(@P1) sr.id, CONVERT(NVARCHAR(30), sr.timestamp, 120), NULL, sr.serial_session_id, s.internal_name,
                            sr.raw_value, CAST(sr.physical_value AS NVARCHAR(MAX)), sr.unit, sr.display_value
                     FROM session_readings sr
                     JOIN signals s ON sr.signal_id = s.id
                     WHERE sr.serial_session_id = @P2
                     ORDER BY sr.timestamp DESC".to_string();
        let mut q = Query::new(query);
        q.bind(limit as i32);
        q.bind(session_id as i32);
        let stream = q.query(&mut *conn).await.map_err(map_db_err)?;
        let rows: Vec<Row> = stream.into_first_result().await.map_err(map_db_err)?;

        Ok(rows.into_iter().map(|row: Row| {
            build_telemetry_reading(
                row.get::<i32, _>(0).map(|v| v as i64),
                row.get::<&str, _>(1).unwrap_or("").to_string(),
                row.get::<i32, _>(2).map(|v| v as i64),
                row.get::<i32, _>(3).unwrap_or(0) as i64,
                row.get::<&str, _>(4).unwrap_or("").to_string(),
                row.get::<i64, _>(5).unwrap_or(0),
                row.get::<&str, _>(6).unwrap_or("0").to_string(),
                row.get::<&str, _>(7).unwrap_or("").to_string(),
                row.get::<&str, _>(8).map(|v: &str| v.to_string()),
                Some(session_id),
            )
        }).collect())
    }
}

// ═══════════════════════════════════════════════
//  VersionRepository
// ═══════════════════════════════════════════════
#[derive(Clone)]
pub struct MssqlVersionRepository {
    pool: Pool<ConnectionManager>,
}

impl MssqlVersionRepository {
    pub fn new(pool: Pool<ConnectionManager>) -> Self {
        Self { pool }
    }
}

impl VersionRepository for MssqlVersionRepository {
    async fn save(&self, version: &VersionInfo) -> Result<(), RepositoryError> {
        let mut conn = self.pool.get().await.map_err(map_db_err)?;
        let mut q = Query::new(
            "INSERT INTO versions (language_id, system_sw, dss_fw, dss_hw, css_fw, css_hw, pss_fw, pss_hw, lang1, lang2, lang3) \
             VALUES (@P1, @P2, @P3, @P4, @P5, @P6, @P7, @P8, @P9, @P10, @P11)"
        );
        q.bind(version.language_id as i32);
        q.bind(version.system_sw.as_str());
        q.bind(version.dss_fw.as_str());
        q.bind(version.dss_hw.as_str());
        q.bind(version.css_fw.as_str());
        q.bind(version.css_hw.as_str());
        q.bind(version.pss_fw.as_str());
        q.bind(version.pss_hw.as_str());
        q.bind(version.language1.as_str());
        q.bind(version.language2.as_str());
        q.bind(version.language3.as_str());
        q.execute(&mut *conn).await.map_err(map_db_err)?;
        Ok(())
    }

    async fn get_latest(&self) -> Result<Option<VersionInfo>, RepositoryError> {
        let mut conn = self.pool.get().await.map_err(map_db_err)?;
        let q = Query::new(
            "SELECT TOP(1) language_id, system_sw, dss_fw, dss_hw, css_fw, css_hw, pss_fw, pss_hw, lang1, lang2, lang3 \
             FROM versions ORDER BY id DESC"
        );
        let stream = q.query(&mut *conn).await.map_err(map_db_err)?;
        let rows: Vec<Row> = stream.into_first_result().await.map_err(map_db_err)?;

        Ok(rows.into_iter().next().map(|r: Row| VersionInfo {
            language_id: r.get::<i32, _>(0).unwrap_or(0) as u16,
            system_sw: r.get::<&str, _>(1).unwrap_or("").to_string(),
            dss_fw:    r.get::<&str, _>(2).unwrap_or("").to_string(),
            dss_hw:    r.get::<&str, _>(3).unwrap_or("").to_string(),
            css_fw:    r.get::<&str, _>(4).unwrap_or("").to_string(),
            css_hw:    r.get::<&str, _>(5).unwrap_or("").to_string(),
            pss_fw:    r.get::<&str, _>(6).unwrap_or("").to_string(),
            pss_hw:    r.get::<&str, _>(7).unwrap_or("").to_string(),
            language1: r.get::<&str, _>(8).unwrap_or("").to_string(),
            language2: r.get::<&str, _>(9).unwrap_or("").to_string(),
            language3: r.get::<&str, _>(10).unwrap_or("").to_string(),
        }))
    }
}

// ═══════════════════════════════════════════════
//  AttributeEquivalenceRepository
// ═══════════════════════════════════════════════
#[derive(Clone)]
pub struct MssqlAttributeEquivalenceRepository {
    pool: Pool<ConnectionManager>,
}

impl MssqlAttributeEquivalenceRepository {
    pub fn new(pool: Pool<ConnectionManager>) -> Self {
        Self { pool }
    }
}

impl AttributeEquivalenceRepository for MssqlAttributeEquivalenceRepository {
    async fn save(&self, equiv: &AttributeEquivalence) -> Result<(), RepositoryError> {
        let signal_id = get_or_create_signal_id(&self.pool, &equiv.internal_name).await? as i32;
        let mut conn = self.pool.get().await.map_err(map_db_err)?;
        let mut q = Query::new(
            "MERGE attribute_equivalences AS tgt \
             USING (SELECT @P1 AS signal_id, @P2 AS numeric_value) AS src \
             ON tgt.signal_id = src.signal_id AND tgt.numeric_value = src.numeric_value \
             WHEN MATCHED THEN UPDATE SET display_name = @P3 \
             WHEN NOT MATCHED THEN INSERT (signal_id, numeric_value, display_name) VALUES (@P1, @P2, @P3);"
        );
        q.bind(signal_id);
        q.bind(equiv.numeric_value);
        q.bind(equiv.display_name.as_str());
        q.execute(&mut *conn).await.map_err(map_db_err)?;
        Ok(())
    }

    async fn save_batch(&self, equivs: &[AttributeEquivalence]) -> Result<(), RepositoryError> {
        for eq in equivs {
            self.save(eq).await?;
        }
        Ok(())
    }

    async fn get_by_internal_name(&self, name: &str) -> Result<Vec<AttributeEquivalence>, RepositoryError> {
        let mut conn = self.pool.get().await.map_err(map_db_err)?;
        let mut q = Query::new(
            "SELECT s.internal_name, e.numeric_value, e.display_name \
             FROM attribute_equivalences e JOIN signals s ON e.signal_id = s.id WHERE s.internal_name = @P1"
        );
        q.bind(name);
        let stream = q.query(&mut *conn).await.map_err(map_db_err)?;
        let rows: Vec<Row> = stream.into_first_result().await.map_err(map_db_err)?;

        Ok(rows.into_iter().map(|r: Row| AttributeEquivalence {
            internal_name: r.get::<&str, _>(0).unwrap_or("").to_string(),
            numeric_value: r.get::<f64, _>(1).unwrap_or(0.0),
            display_name: r.get::<&str, _>(2).unwrap_or("").to_string(),
        }).collect())
    }

    async fn get_all(&self) -> Result<Vec<AttributeEquivalence>, RepositoryError> {
        let mut conn = self.pool.get().await.map_err(map_db_err)?;
        let q = Query::new(
            "SELECT s.internal_name, e.numeric_value, e.display_name \
             FROM attribute_equivalences e JOIN signals s ON e.signal_id = s.id"
        );
        let stream = q.query(&mut *conn).await.map_err(map_db_err)?;
        let rows: Vec<Row> = stream.into_first_result().await.map_err(map_db_err)?;

        Ok(rows.into_iter().map(|r: Row| AttributeEquivalence {
            internal_name: r.get::<&str, _>(0).unwrap_or("").to_string(),
            numeric_value: r.get::<f64, _>(1).unwrap_or(0.0),
            display_name: r.get::<&str, _>(2).unwrap_or("").to_string(),
        }).collect())
    }
}

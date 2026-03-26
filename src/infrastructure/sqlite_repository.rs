//! SQLite implementations of all domain repository traits.
//! To switch to PostgreSQL/MySQL, create a parallel file implementing
//! the same traits — the application layer (use_cases.rs) remains unchanged.

use rusqlite::{Connection, params};
use std::sync::{Arc, Mutex};

use crate::domain::entities::{
    AttributeEquivalence, DataAttribute, DataType, DictionaryEntry, TelemetryReading, TelemetryValue, VersionInfo,
};
use crate::domain::repositories::{
    AttributeEquivalenceRepository, DataAttributeRepository, DictionaryRepository, RepositoryError,
    TelemetryRepository, VersionRepository,
};

// ───────────────────────────────────────────────
//  Helper: lock the connection
// ───────────────────────────────────────────────
fn lock_conn(conn: &Arc<Mutex<Connection>>) -> Result<std::sync::MutexGuard<'_, Connection>, RepositoryError> {
    conn.lock().map_err(|e| RepositoryError::DatabaseError(e.to_string()))
}

fn get_or_create_signal_id(conn: &Connection, name: &str) -> rusqlite::Result<i64> {
    conn.execute("INSERT OR IGNORE INTO signals (internal_name) VALUES (?1)", params![name])?;
    conn.query_row("SELECT id FROM signals WHERE internal_name = ?1", params![name], |r| r.get(0))
}


// ═══════════════════════════════════════════════
//  DataAttributeRepository (sensors/handles)
// ═══════════════════════════════════════════════
pub struct SqliteDataAttrRepository {
    conn: Arc<Mutex<Connection>>,
}

impl SqliteDataAttrRepository {
    pub fn new(conn: Arc<Mutex<Connection>>) -> Self {
        Self { conn }
    }
}

impl DataAttributeRepository for SqliteDataAttrRepository {
    fn save(&self, attr: &DataAttribute) -> Result<(), RepositoryError> {
        let conn = lock_conn(&self.conn)?;
        let signal_id = get_or_create_signal_id(&conn, &attr.internal_name)
            .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;
            
        conn.execute(
            "INSERT OR REPLACE INTO data_attributes (handle, data_type, size, conversion_factor, label_did, unit_did, signal_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                attr.handle,
                attr.data_type as u16,
                attr.size,
                attr.conversion_factor,
                attr.label_did,
                attr.unit_did,
                signal_id,
            ],
        ).map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    fn get_all(&self) -> Result<Vec<DataAttribute>, RepositoryError> {
        let conn = lock_conn(&self.conn)?;
        let mut stmt = conn.prepare(
            "SELECT d.handle, d.data_type, d.size, d.conversion_factor, d.label_did, d.unit_did, d.signal_id, s.internal_name 
             FROM data_attributes d
             JOIN signals s ON d.signal_id = s.id
             ORDER BY d.rowid"
        ).map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        let iter = stmt.query_map([], |row| {
            Ok(DataAttribute {
                handle: row.get::<_, u16>(0)?,
                data_type: DataType::from(row.get::<_, u16>(1)?),
                size: row.get::<_, u16>(2)?,
                conversion_factor: row.get::<_, u16>(3)?,
                label_did: row.get::<_, u16>(4)?,
                unit_did: row.get::<_, u16>(5)?,
                signal_id: row.get::<_, i64>(6)?,
                internal_name: row.get::<_, String>(7)?,
            })
        }).map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        let mut result = Vec::new();
        for item in iter {
            result.push(item.map_err(|e| RepositoryError::DatabaseError(e.to_string()))?);
        }
        Ok(result)
    }

    fn get_by_handle(&self, handle: u16) -> Result<Option<DataAttribute>, RepositoryError> {
        let conn = lock_conn(&self.conn)?;
        let mut stmt = conn.prepare(
            "SELECT d.handle, d.data_type, d.size, d.conversion_factor, d.label_did, d.unit_did, d.signal_id, s.internal_name 
             FROM data_attributes d
             JOIN signals s ON d.signal_id = s.id
             WHERE d.handle = ?1"
        ).map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        let mut rows = stmt.query_map(params![handle], |row| {
            Ok(DataAttribute {
                handle: row.get::<_, u16>(0)?,
                data_type: DataType::from(row.get::<_, u16>(1)?),
                size: row.get::<_, u16>(2)?,
                conversion_factor: row.get::<_, u16>(3)?,
                label_did: row.get::<_, u16>(4)?,
                unit_did: row.get::<_, u16>(5)?,
                signal_id: row.get::<_, i64>(6)?,
                internal_name: row.get::<_, String>(7)?,
            })
        }).map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        match rows.next() {
            Some(Ok(attr)) => Ok(Some(attr)),
            Some(Err(e)) => Err(RepositoryError::DatabaseError(e.to_string())),
            None => Ok(None),
        }
    }

    fn delete_all(&self) -> Result<(), RepositoryError> {
        let conn = lock_conn(&self.conn)?;
        conn.execute("DELETE FROM data_attributes", [])
            .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;
        Ok(())
    }
}

// ═══════════════════════════════════════════════
//  DictionaryRepository
// ═══════════════════════════════════════════════
pub struct SqliteDictionaryRepository {
    conn: Arc<Mutex<Connection>>,
}

impl SqliteDictionaryRepository {
    pub fn new(conn: Arc<Mutex<Connection>>) -> Self {
        Self { conn }
    }
}

impl DictionaryRepository for SqliteDictionaryRepository {
    fn save(&self, entry: &DictionaryEntry) -> Result<(), RepositoryError> {
        let conn = lock_conn(&self.conn)?;
        conn.execute(
            "INSERT OR REPLACE INTO dictionary (dict_id, text) VALUES (?1, ?2)",
            params![entry.dict_id, entry.text],
        ).map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    fn get_by_id(&self, dict_id: u16) -> Result<Option<DictionaryEntry>, RepositoryError> {
        let conn = lock_conn(&self.conn)?;
        let mut stmt = conn.prepare("SELECT dict_id, text FROM dictionary WHERE dict_id = ?1")
            .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        let mut rows = stmt.query_map(params![dict_id], |row| {
            Ok(DictionaryEntry {
                dict_id: row.get::<_, u16>(0)?,
                text: row.get::<_, String>(1)?,
            })
        }).map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        match rows.next() {
            Some(Ok(entry)) => Ok(Some(entry)),
            Some(Err(e)) => Err(RepositoryError::DatabaseError(e.to_string())),
            None => Ok(None),
        }
    }

    fn get_all(&self) -> Result<Vec<DictionaryEntry>, RepositoryError> {
        let conn = lock_conn(&self.conn)?;
        let mut stmt = conn.prepare(
            "SELECT dict_id, text FROM dictionary ORDER BY dict_id"
        ).map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        let iter = stmt.query_map([], |row| {
            Ok(DictionaryEntry {
                dict_id: row.get::<_, u16>(0)?,
                text: row.get::<_, String>(1)?,
            })
        }).map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        let mut result = Vec::new();
        for item in iter {
            result.push(item.map_err(|e| RepositoryError::DatabaseError(e.to_string()))?);
        }
        Ok(result)
    }

    fn delete_all(&self) -> Result<(), RepositoryError> {
        let conn = lock_conn(&self.conn)?;
        conn.execute("DELETE FROM dictionary", [])
            .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;
        Ok(())
    }
}

// ═══════════════════════════════════════════════
//  TelemetryRepository
// ═══════════════════════════════════════════════
pub struct SqliteTelemetryRepository {
    conn: Arc<Mutex<Connection>>,
}

impl SqliteTelemetryRepository {
    pub fn new(conn: Arc<Mutex<Connection>>) -> Self {
        Self { conn }
    }
}

impl TelemetryRepository for SqliteTelemetryRepository {
    fn save(&self, reading: &TelemetryReading) -> Result<(), RepositoryError> {
        let conn = lock_conn(&self.conn)?;
        let p_val: rusqlite::types::Value = match &reading.physical_value {
            TelemetryValue::Number(n) => rusqlite::types::Value::Real(*n),
            TelemetryValue::String(s) => rusqlite::types::Value::Text(s.clone()),
        };
        conn.execute(
            "INSERT INTO telemetry (patient_id, signal_id, raw_value, physical_value, unit)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                reading.patient_id,
                reading.signal_id,
                reading.raw_value,
                p_val,
                reading.unit,
            ],
        ).map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    fn save_batch(&self, readings: &[TelemetryReading]) -> Result<(), RepositoryError> {
        let mut guard = lock_conn(&self.conn)?;
        let tx = guard.transaction().map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;
        {
            let mut stmt = tx.prepare(
                "INSERT INTO telemetry (patient_id, signal_id, raw_value, physical_value, unit)
                 VALUES (?1, ?2, ?3, ?4, ?5)"
            ).map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

            for reading in readings {
                let p_val: rusqlite::types::Value = match &reading.physical_value {
                    TelemetryValue::Number(n) => rusqlite::types::Value::Real(*n),
                    TelemetryValue::String(s) => rusqlite::types::Value::Text(s.clone()),
                };
                stmt.execute(params![
                    reading.patient_id,
                    reading.signal_id,
                    reading.raw_value,
                    p_val,
                    reading.unit,
                ]).map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;
            }
        }
        tx.commit().map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    fn get_recent_readings(&self, limit: u32) -> Result<Vec<TelemetryReading>, RepositoryError> {
        let conn = lock_conn(&self.conn)?;
        let mut stmt = conn.prepare(
            "SELECT t.id, t.timestamp, t.patient_id, t.signal_id, s.internal_name, t.raw_value, t.physical_value, t.unit, e.display_name
             FROM telemetry t
             JOIN signals s ON t.signal_id = s.id
             LEFT JOIN attribute_equivalences e ON s.id = e.signal_id AND t.physical_value = e.numeric_value
             ORDER BY t.id DESC LIMIT ?1"
        ).map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        let iter = stmt.query_map(params![limit], |row| {
            let val: rusqlite::types::Value = row.get(6)?;
            let physical_value = match val {
                rusqlite::types::Value::Real(n) => TelemetryValue::Number(n),
                rusqlite::types::Value::Integer(i) => TelemetryValue::Number(i as f64),
                rusqlite::types::Value::Text(s) => TelemetryValue::String(s),
                _ => TelemetryValue::Number(0.0),
            };
            Ok(TelemetryReading {
                id: Some(row.get::<_, i64>(0)?),
                timestamp: row.get::<_, String>(1)?,
                patient_id: row.get::<_, Option<i64>>(2)?,
                signal_id: row.get::<_, i64>(3)?,
                internal_name: row.get::<_, String>(4)?,
                raw_value: row.get::<_, i64>(5)?,
                physical_value,
                unit: row.get::<_, String>(7)?,
                display_value: row.get::<_, Option<String>>(8)?,
            })
        }).map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        let mut result = Vec::new();
        for item in iter {
            result.push(item.map_err(|e| RepositoryError::DatabaseError(e.to_string()))?);
        }
        Ok(result)
    }

    fn get_or_create_patient(&self, patient_id_str: &str) -> Result<i64, RepositoryError> {
        let conn = lock_conn(&self.conn)?;
        conn.execute(
            "INSERT OR IGNORE INTO patients (patient_id_str) VALUES (?1)",
            params![patient_id_str],
        ).map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        let id_val: i64 = conn.query_row(
            "SELECT id FROM patients WHERE patient_id_str = ?1",
            params![patient_id_str],
            |r| r.get(0),
        ).map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        Ok(id_val)
    }

    fn get_patient_history(&self, patient_id_str: &str, limit: u32) -> Result<Vec<TelemetryReading>, RepositoryError> {
        let conn = lock_conn(&self.conn)?;
        let mut stmt = conn.prepare(
            "SELECT t.id, t.timestamp, t.patient_id, t.signal_id, s.internal_name, t.raw_value, t.physical_value, t.unit, e.display_name
             FROM telemetry t
             JOIN patients p ON t.patient_id = p.id
             JOIN signals s ON t.signal_id = s.id
             LEFT JOIN attribute_equivalences e ON s.id = e.signal_id AND t.physical_value = e.numeric_value
             WHERE p.patient_id_str = ?1
             ORDER BY t.timestamp DESC LIMIT ?2"
        ).map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        let iter = stmt.query_map(params![patient_id_str, limit], |row| {
            let val: rusqlite::types::Value = row.get(6)?;
            let physical_value = match val {
                rusqlite::types::Value::Real(n) => TelemetryValue::Number(n),
                rusqlite::types::Value::Integer(i) => TelemetryValue::Number(i as f64),
                rusqlite::types::Value::Text(s) => TelemetryValue::String(s),
                _ => TelemetryValue::Number(0.0),
            };
            Ok(TelemetryReading {
                id: Some(row.get::<_, i64>(0)?),
                timestamp: row.get::<_, String>(1)?,
                patient_id: row.get::<_, Option<i64>>(2)?,
                signal_id: row.get::<_, i64>(3)?,
                internal_name: row.get::<_, String>(4)?,
                raw_value: row.get::<_, i64>(5)?,
                physical_value,
                unit: row.get::<_, String>(7)?,
                display_value: row.get::<_, Option<String>>(8)?,
            })
        }).map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        let mut result = Vec::new();
        for item in iter {
            result.push(item.map_err(|e| RepositoryError::DatabaseError(e.to_string()))?);
        }
        Ok(result)
    }
}

// ═══════════════════════════════════════════════
//  VersionRepository
// ═══════════════════════════════════════════════
pub struct SqliteVersionRepository {
    conn: Arc<Mutex<Connection>>,
}

impl SqliteVersionRepository {
    pub fn new(conn: Arc<Mutex<Connection>>) -> Self {
        Self { conn }
    }
}

impl VersionRepository for SqliteVersionRepository {
    fn save(&self, version: &VersionInfo) -> Result<(), RepositoryError> {
        let conn = lock_conn(&self.conn)?;
        conn.execute(
            "INSERT INTO versions (language_id, system_sw, dss_fw, dss_hw, css_fw, css_hw, pss_fw, pss_hw, lang1, lang2, lang3)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                version.language_id,
                version.system_sw,
                version.dss_fw,
                version.dss_hw,
                version.css_fw,
                version.css_hw,
                version.pss_fw,
                version.pss_hw,
                version.language1,
                version.language2,
                version.language3,
            ],
        ).map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    fn get_latest(&self) -> Result<Option<VersionInfo>, RepositoryError> {
        let conn = lock_conn(&self.conn)?;
        let mut stmt = conn.prepare(
            "SELECT language_id, system_sw, dss_fw, dss_hw, css_fw, css_hw, pss_fw, pss_hw, lang1, lang2, lang3
             FROM versions ORDER BY id DESC LIMIT 1"
        ).map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        let mut rows = stmt.query_map([], |row| {
            Ok(VersionInfo {
                language_id: row.get::<_, u16>(0)?,
                system_sw: row.get::<_, String>(1)?,
                dss_fw: row.get::<_, String>(2)?,
                dss_hw: row.get::<_, String>(3)?,
                css_fw: row.get::<_, String>(4)?,
                css_hw: row.get::<_, String>(5)?,
                pss_fw: row.get::<_, String>(6)?,
                pss_hw: row.get::<_, String>(7)?,
                language1: row.get::<_, String>(8)?,
                language2: row.get::<_, String>(9)?,
                language3: row.get::<_, String>(10)?,
            })
        }).map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        match rows.next() {
            Some(Ok(v)) => Ok(Some(v)),
            Some(Err(e)) => Err(RepositoryError::DatabaseError(e.to_string())),
            None => Ok(None),
        }
    }
}

// ═══════════════════════════════════════════════
//  AttributeEquivalenceRepository
// ═══════════════════════════════════════════════
pub struct SqliteAttributeEquivalenceRepository {
    conn: Arc<Mutex<Connection>>,
}

impl SqliteAttributeEquivalenceRepository {
    pub fn new(conn: Arc<Mutex<Connection>>) -> Self {
        Self { conn }
    }
}

impl AttributeEquivalenceRepository for SqliteAttributeEquivalenceRepository {
    fn save(&self, equiv: &AttributeEquivalence) -> Result<(), RepositoryError> {
        let conn = lock_conn(&self.conn)?;
        let signal_id = get_or_create_signal_id(&conn, &equiv.internal_name)
            .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        conn.execute(
            "INSERT OR REPLACE INTO attribute_equivalences (signal_id, numeric_value, display_name)
             VALUES (?1, ?2, ?3)",
            params![signal_id, equiv.numeric_value, equiv.display_name],
        ).map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    fn save_batch(&self, equivs: &[AttributeEquivalence]) -> Result<(), RepositoryError> {
        let mut guard = lock_conn(&self.conn)?;
        let tx = guard.transaction().map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;
        {
            let mut stmt = tx.prepare(
                "INSERT OR REPLACE INTO attribute_equivalences (signal_id, numeric_value, display_name)
                 VALUES (?1, ?2, ?3)"
            ).map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

            for eq in equivs {
                let sig_id = get_or_create_signal_id(&tx, &eq.internal_name)
                    .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;
                stmt.execute(params![sig_id, eq.numeric_value, eq.display_name])
                    .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;
            }
        }
        tx.commit().map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    fn get_by_internal_name(&self, name: &str) -> Result<Vec<AttributeEquivalence>, RepositoryError> {
        let conn = lock_conn(&self.conn)?;
        let mut stmt = conn.prepare(
            "SELECT s.internal_name, e.numeric_value, e.display_name 
             FROM attribute_equivalences e
             JOIN signals s ON e.signal_id = s.id
             WHERE s.internal_name = ?1"
        ).map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        let iter = stmt.query_map(params![name], |row| {
            Ok(AttributeEquivalence {
                internal_name: row.get(0)?,
                numeric_value: row.get(1)?,
                display_name: row.get(2)?,
            })
        }).map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        let mut res = Vec::new();
        for item in iter {
            res.push(item.map_err(|e| RepositoryError::DatabaseError(e.to_string()))?);
        }
        Ok(res)
    }

    fn get_all(&self) -> Result<Vec<AttributeEquivalence>, RepositoryError> {
        let conn = lock_conn(&self.conn)?;
        let mut stmt = conn.prepare(
            "SELECT s.internal_name, e.numeric_value, e.display_name 
             FROM attribute_equivalences e
             JOIN signals s ON e.signal_id = s.id"
        ).map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        let iter = stmt.query_map([], |row| {
            Ok(AttributeEquivalence {
                internal_name: row.get(0)?,
                numeric_value: row.get(1)?,
                display_name: row.get(2)?,
            })
        }).map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        let mut res = Vec::new();
        for item in iter {
            res.push(item.map_err(|e| RepositoryError::DatabaseError(e.to_string()))?);
        }
        Ok(res)
    }
}

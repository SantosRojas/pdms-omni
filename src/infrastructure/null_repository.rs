//! No-op / in-memory repositories for degraded mode when persistence is unavailable.
//! Allows protocol operation and real-time telemetry without durable storage.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::domain::entities::{
    AttributeEquivalence, DataAttribute, DictionaryEntry, TelemetryReading, VersionInfo,
};
use crate::domain::repositories::{
    AttributeEquivalenceRepository, DataAttributeRepository, DictionaryRepository, RepositoryError,
    TelemetryRepository, VersionRepository,
};

#[derive(Clone)]
pub struct NullDataAttrRepository;

impl NullDataAttrRepository {
    pub fn new() -> Self {
        Self
    }
}

impl DataAttributeRepository for NullDataAttrRepository {
    async fn save(
        &self,
        _attr: &DataAttribute,
        _version_fingerprint: &str,
    ) -> Result<(), RepositoryError> {
        Ok(())
    }

    async fn get_by_fingerprint(
        &self,
        _fingerprint: &str,
    ) -> Result<Vec<DataAttribute>, RepositoryError> {
        Ok(Vec::new())
    }

    async fn get_by_handle(&self, _handle: u16) -> Result<Option<DataAttribute>, RepositoryError> {
        Ok(None)
    }

    async fn delete_by_fingerprint(&self, _fingerprint: &str) -> Result<(), RepositoryError> {
        Ok(())
    }
}

#[derive(Clone)]
pub struct NullDictionaryRepository;

impl NullDictionaryRepository {
    pub fn new() -> Self {
        Self
    }
}

impl DictionaryRepository for NullDictionaryRepository {
    async fn save(
        &self,
        _entry: &DictionaryEntry,
        _version_fingerprint: &str,
    ) -> Result<(), RepositoryError> {
        Ok(())
    }

    async fn save_batch(
        &self,
        _entries: &[DictionaryEntry],
        _version_fingerprint: &str,
    ) -> Result<(), RepositoryError> {
        Ok(())
    }

    async fn get_by_fingerprint(
        &self,
        _fingerprint: &str,
    ) -> Result<Vec<DictionaryEntry>, RepositoryError> {
        Ok(Vec::new())
    }

    async fn get_by_id(&self, _dict_id: u16) -> Result<Option<DictionaryEntry>, RepositoryError> {
        Ok(None)
    }

    async fn delete_by_fingerprint(&self, _fingerprint: &str) -> Result<(), RepositoryError> {
        Ok(())
    }
}

#[derive(Clone)]
pub struct NullTelemetryRepository {
    patients: Arc<Mutex<HashMap<String, i64>>>,
    next_id: Arc<Mutex<i64>>,
    next_therapy_id: Arc<Mutex<i64>>,
}

impl NullTelemetryRepository {
    pub fn new() -> Self {
        Self {
            patients: Arc::new(Mutex::new(HashMap::new())),
            next_id: Arc::new(Mutex::new(1)),
            next_therapy_id: Arc::new(Mutex::new(1)),
        }
    }
}

impl TelemetryRepository for NullTelemetryRepository {
    async fn save(&self, _reading: &TelemetryReading) -> Result<(), RepositoryError> {
        Ok(())
    }

    async fn save_batch(&self, _readings: &[TelemetryReading]) -> Result<(), RepositoryError> {
        Ok(())
    }

    async fn get_recent_readings(
        &self,
        _limit: u32,
    ) -> Result<Vec<TelemetryReading>, RepositoryError> {
        Ok(Vec::new())
    }

    async fn get_or_create_machine(
        &self,
        _serial_number: &str,
        _software_version: &str,
    ) -> Result<i64, RepositoryError> {
        Ok(1)
    }

    async fn get_or_create_patient(&self, patient_id_str: &str) -> Result<i64, RepositoryError> {
        let mut patients = self
            .patients
            .lock()
            .map_err(|_| RepositoryError::DatabaseError("patient map lock poisoned".to_string()))?;

        if let Some(id) = patients.get(patient_id_str) {
            return Ok(*id);
        }

        let mut next_id = self
            .next_id
            .lock()
            .map_err(|_| RepositoryError::DatabaseError("patient id lock poisoned".to_string()))?;
        let assigned = *next_id;
        *next_id += 1;

        patients.insert(patient_id_str.to_string(), assigned);
        Ok(assigned)
    }

    async fn get_or_create_therapy(
        &self,
        _patient_id: i64,
        _machine_id: i64,
        _started_at: &str,
        _force_new: bool,
        _serial_session_id: Option<i64>,
    ) -> Result<i64, RepositoryError> {
        let mut next_therapy_id = self
            .next_therapy_id
            .lock()
            .map_err(|_| RepositoryError::DatabaseError("therapy id lock poisoned".to_string()))?;
        let assigned = *next_therapy_id;
        *next_therapy_id += 1;
        Ok(assigned)
    }

    async fn get_therapy_history(
        &self,
        _therapy_id: i64,
        _limit: u32,
    ) -> Result<Vec<TelemetryReading>, RepositoryError> {
        Ok(Vec::new())
    }

    async fn set_therapy_end(&self, _therapy_id: i64) -> Result<(), RepositoryError> {
        Ok(())
    }

    async fn create_serial_session(
        &self,
        _machine_id: i64,
        _patient_id_str: &str,
    ) -> Result<i64, RepositoryError> {
        Ok(1)
    }

    async fn end_serial_session(&self, _session_id: i64) -> Result<(), RepositoryError> {
        Ok(())
    }

    async fn save_session_readings(
        &self,
        _session_id: i64,
        _readings: &[TelemetryReading],
        _phase: &str,
    ) -> Result<(), RepositoryError> {
        Ok(())
    }

    async fn get_session_readings(
        &self,
        _session_id: i64,
        _limit: u32,
    ) -> Result<Vec<TelemetryReading>, RepositoryError> {
        Ok(Vec::new())
    }
}

#[derive(Clone)]
pub struct NullVersionRepository;

impl NullVersionRepository {
    pub fn new() -> Self {
        Self
    }
}

impl VersionRepository for NullVersionRepository {
    async fn save(&self, _version: &VersionInfo) -> Result<(), RepositoryError> {
        Ok(())
    }

    async fn save_initialization(
        &self,
        _version: &VersionInfo,
        _attrs: &[DataAttribute],
        _dict_entries: &[DictionaryEntry],
    ) -> Result<(), RepositoryError> {
        Ok(())
    }

    async fn get_by_fingerprint(
        &self,
        _fingerprint: &str,
    ) -> Result<Option<VersionInfo>, RepositoryError> {
        Ok(None)
    }
}

#[derive(Clone)]
pub struct NullAttributeEquivalenceRepository;

impl NullAttributeEquivalenceRepository {
    pub fn new() -> Self {
        Self
    }
}

impl AttributeEquivalenceRepository for NullAttributeEquivalenceRepository {
    async fn save(&self, _equiv: &AttributeEquivalence) -> Result<(), RepositoryError> {
        Ok(())
    }

    async fn save_batch(&self, _equivs: &[AttributeEquivalence]) -> Result<(), RepositoryError> {
        Ok(())
    }

    async fn get_by_internal_name(
        &self,
        _name: &str,
    ) -> Result<Vec<AttributeEquivalence>, RepositoryError> {
        Ok(Vec::new())
    }

    async fn get_all(&self) -> Result<Vec<AttributeEquivalence>, RepositoryError> {
        Ok(Vec::new())
    }
}

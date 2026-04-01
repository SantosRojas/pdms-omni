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

pub struct NullDataAttrRepository;

impl NullDataAttrRepository {
    pub fn new() -> Self {
        Self
    }
}

impl DataAttributeRepository for NullDataAttrRepository {
    async fn save(&self, _attr: &DataAttribute) -> Result<(), RepositoryError> {
        Ok(())
    }

    async fn get_all(&self) -> Result<Vec<DataAttribute>, RepositoryError> {
        Ok(Vec::new())
    }

    async fn get_by_handle(&self, _handle: u16) -> Result<Option<DataAttribute>, RepositoryError> {
        Ok(None)
    }

    async fn delete_all(&self) -> Result<(), RepositoryError> {
        Ok(())
    }
}

pub struct NullDictionaryRepository;

impl NullDictionaryRepository {
    pub fn new() -> Self {
        Self
    }
}

impl DictionaryRepository for NullDictionaryRepository {
    async fn save(&self, _entry: &DictionaryEntry) -> Result<(), RepositoryError> {
        Ok(())
    }

    async fn get_all(&self) -> Result<Vec<DictionaryEntry>, RepositoryError> {
        Ok(Vec::new())
    }

    async fn get_by_id(&self, _dict_id: u16) -> Result<Option<DictionaryEntry>, RepositoryError> {
        Ok(None)
    }

    async fn delete_all(&self) -> Result<(), RepositoryError> {
        Ok(())
    }
}

pub struct NullTelemetryRepository {
    patients: Arc<Mutex<HashMap<String, i64>>>,
    next_id: Arc<Mutex<i64>>,
}

impl NullTelemetryRepository {
    pub fn new() -> Self {
        Self {
            patients: Arc::new(Mutex::new(HashMap::new())),
            next_id: Arc::new(Mutex::new(1)),
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

    async fn get_recent_readings(&self, _limit: u32) -> Result<Vec<TelemetryReading>, RepositoryError> {
        Ok(Vec::new())
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

    async fn get_patient_history(&self, _patient_id_str: &str, _limit: u32) -> Result<Vec<TelemetryReading>, RepositoryError> {
        Ok(Vec::new())
    }

    async fn set_therapy_start(&self, _patient_id: i64) -> Result<(), RepositoryError> {
        Ok(())
    }

    async fn set_therapy_end(&self, _patient_id: i64) -> Result<(), RepositoryError> {
        Ok(())
    }
}

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

    async fn get_latest(&self) -> Result<Option<VersionInfo>, RepositoryError> {
        Ok(None)
    }
}

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

    async fn get_by_internal_name(&self, _name: &str) -> Result<Vec<AttributeEquivalence>, RepositoryError> {
        Ok(Vec::new())
    }

    async fn get_all(&self) -> Result<Vec<AttributeEquivalence>, RepositoryError> {
        Ok(Vec::new())
    }
}

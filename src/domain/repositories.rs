//! Domain repository traits.
//! Define the contracts for persistence that infrastructure must fulfill.

#![allow(dead_code)]

use super::entities::{AttributeEquivalence, DataAttribute, DictionaryEntry, TelemetryReading, VersionInfo};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum RepositoryError {
    #[error("Database error: {0}")]
    DatabaseError(String),
}

/// Persists and retrieves data attribute definitions.
pub trait DataAttributeRepository {
    fn save(&self, attr: &DataAttribute) -> Result<(), RepositoryError>;
    fn get_all(&self) -> Result<Vec<DataAttribute>, RepositoryError>;
    fn get_by_handle(&self, handle: u16) -> Result<Option<DataAttribute>, RepositoryError>;
    fn delete_all(&self) -> Result<(), RepositoryError>;
}

/// Persists and retrieves dictionary entries (labels, units, etc.).
pub trait DictionaryRepository {
    fn save(&self, entry: &DictionaryEntry) -> Result<(), RepositoryError>;
    fn get_all(&self) -> Result<Vec<DictionaryEntry>, RepositoryError>;
    fn get_by_id(&self, dict_id: u16) -> Result<Option<DictionaryEntry>, RepositoryError>;
    fn delete_all(&self) -> Result<(), RepositoryError>;
}

/// Persists telemetry readings.
pub trait TelemetryRepository {
    fn save(&self, reading: &TelemetryReading) -> Result<(), RepositoryError>;
    fn save_batch(&self, readings: &[TelemetryReading]) -> Result<(), RepositoryError> {
        for r in readings {
            self.save(r)?;
        }
        Ok(())
    }
    /// Retrieve the most recent readings from the database
    fn get_recent_readings(&self, limit: u32) -> Result<Vec<TelemetryReading>, RepositoryError>;
    
    /// Maps a patient string ID to an auto-incrementing integer primary key
    fn get_or_create_patient(&self, patient_id_str: &str) -> Result<i64, RepositoryError>;
    
    /// Retrieves historical telemetry for a specific patient
    fn get_patient_history(&self, patient_id_str: &str, limit: u32) -> Result<Vec<TelemetryReading>, RepositoryError>;
}

/// Persists version information for caching/comparison.
pub trait VersionRepository {
    fn save(&self, version: &VersionInfo) -> Result<(), RepositoryError>;
    fn get_latest(&self) -> Result<Option<VersionInfo>, RepositoryError>;
}

/// CRUD for value equivalences (e.g., 0.0 = Preparation).
/// numeric_value is the physical/final value after applying the conversion factor.
pub trait AttributeEquivalenceRepository {
    fn save(&self, equiv: &AttributeEquivalence) -> Result<(), RepositoryError>;
    fn save_batch(&self, equivs: &[AttributeEquivalence]) -> Result<(), RepositoryError>;
    fn get_by_internal_name(&self, name: &str) -> Result<Vec<AttributeEquivalence>, RepositoryError>;
    fn get_all(&self) -> Result<Vec<AttributeEquivalence>, RepositoryError>;
}

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
pub trait DataAttributeRepository: Send + Sync {
    async fn save(&self, attr: &DataAttribute) -> Result<(), RepositoryError>;
    async fn get_all(&self) -> Result<Vec<DataAttribute>, RepositoryError>;
    async fn get_by_handle(&self, handle: u16) -> Result<Option<DataAttribute>, RepositoryError>;
    async fn delete_all(&self) -> Result<(), RepositoryError>;
}

/// Persists and retrieves dictionary entries (labels, units, etc.).
pub trait DictionaryRepository: Send + Sync {
    async fn save(&self, entry: &DictionaryEntry) -> Result<(), RepositoryError>;
    async fn get_all(&self) -> Result<Vec<DictionaryEntry>, RepositoryError>;
    async fn get_by_id(&self, dict_id: u16) -> Result<Option<DictionaryEntry>, RepositoryError>;
    async fn delete_all(&self) -> Result<(), RepositoryError>;
}

/// Persists telemetry readings.
pub trait TelemetryRepository: Send + Sync {
    async fn save(&self, reading: &TelemetryReading) -> Result<(), RepositoryError>;
    
    async fn save_batch(&self, readings: &[TelemetryReading]) -> Result<(), RepositoryError> {
        for r in readings {
            self.save(r).await?;
        }
        Ok(())
    }
    
    /// Retrieve the most recent readings from the database
    async fn get_recent_readings(&self, limit: u32) -> Result<Vec<TelemetryReading>, RepositoryError>;
    
    /// Maps a patient string ID to an auto-incrementing integer primary key
    async fn get_or_create_patient(&self, patient_id_str: &str) -> Result<i64, RepositoryError>;
    
    /// Retrieves historical telemetry for a specific patient
    async fn get_patient_history(&self, patient_id_str: &str, limit: u32) -> Result<Vec<TelemetryReading>, RepositoryError>;

    /// Updates the therapy start timestamp for a patient (only if not already set or specifically requested)
    async fn set_therapy_start(&self, patient_id: i64) -> Result<(), RepositoryError>;

    /// Updates the therapy end timestamp for a patient
    async fn set_therapy_end(&self, patient_id: i64) -> Result<(), RepositoryError>;
}

/// Persists version information for caching/comparison.
pub trait VersionRepository: Send + Sync {
    async fn save(&self, version: &VersionInfo) -> Result<(), RepositoryError>;
    async fn get_latest(&self) -> Result<Option<VersionInfo>, RepositoryError>;
}

/// CRUD for value equivalences (e.g., 0.0 = Preparation).
/// numeric_value is the physical/final value after applying the conversion factor.
pub trait AttributeEquivalenceRepository: Send + Sync {
    async fn save(&self, equiv: &AttributeEquivalence) -> Result<(), RepositoryError>;
    async fn save_batch(&self, equivs: &[AttributeEquivalence]) -> Result<(), RepositoryError>;
    async fn get_by_internal_name(&self, name: &str) -> Result<Vec<AttributeEquivalence>, RepositoryError>;
    async fn get_all(&self) -> Result<Vec<AttributeEquivalence>, RepositoryError>;
}

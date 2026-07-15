//! Domain repository traits.
//! Define the contracts for persistence that infrastructure must fulfill.

// Methods are used through the enum dispatch in repo_dispatch.rs
// which the compiler cannot always track.
#![allow(dead_code)]

use super::entities::{
    AttributeEquivalence, DataAttribute, DictionaryEntry, TelemetryReading, VersionInfo,
};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum RepositoryError {
    #[error("Database error: {0}")]
    DatabaseError(String),
}

/// Persists and retrieves data attribute definitions.
pub trait DataAttributeRepository: Send + Sync {
    async fn save(
        &self,
        attr: &DataAttribute,
        version_fingerprint: &str,
    ) -> Result<(), RepositoryError>;
    async fn get_by_fingerprint(
        &self,
        fingerprint: &str,
    ) -> Result<Vec<DataAttribute>, RepositoryError>;
    async fn get_by_handle(&self, handle: u16) -> Result<Option<DataAttribute>, RepositoryError>;
    async fn delete_by_fingerprint(&self, fingerprint: &str) -> Result<(), RepositoryError>;
}

/// Persists and retrieves dictionary entries (labels, units, etc.).
pub trait DictionaryRepository: Send + Sync {
    async fn save(
        &self,
        entry: &DictionaryEntry,
        version_fingerprint: &str,
    ) -> Result<(), RepositoryError>;
    async fn save_batch(
        &self,
        entries: &[DictionaryEntry],
        version_fingerprint: &str,
    ) -> Result<(), RepositoryError> {
        for entry in entries {
            self.save(entry, version_fingerprint).await?;
        }
        Ok(())
    }
    async fn get_by_fingerprint(
        &self,
        fingerprint: &str,
    ) -> Result<Vec<DictionaryEntry>, RepositoryError>;
    async fn get_by_id(&self, dict_id: u16) -> Result<Option<DictionaryEntry>, RepositoryError>;
    async fn delete_by_fingerprint(&self, fingerprint: &str) -> Result<(), RepositoryError>;
}

/// Persists telemetry readings and manages serial sessions.
pub trait TelemetryRepository: Send + Sync {
    async fn save(&self, reading: &TelemetryReading) -> Result<(), RepositoryError>;

    async fn save_batch(&self, readings: &[TelemetryReading]) -> Result<(), RepositoryError> {
        for r in readings {
            self.save(r).await?;
        }
        Ok(())
    }

    /// Retrieve the most recent readings from the database
    async fn get_recent_readings(
        &self,
        limit: u32,
    ) -> Result<Vec<TelemetryReading>, RepositoryError>;

    /// Registers the connected OMNI machine by serial number and software version.
    async fn get_or_create_machine(
        &self,
        serial_number: &str,
        software_version: &str,
    ) -> Result<i64, RepositoryError>;

    /// Maps a patient string ID to an auto-incrementing integer primary key
    async fn get_or_create_patient(&self, patient_id_str: &str) -> Result<i64, RepositoryError>;

    /// Creates or retrieves a therapy session for a patient/machine.
    async fn get_or_create_therapy(
        &self,
        patient_id: i64,
        machine_id: i64,
        started_at: &str,
        force_new: bool,
        serial_session_id: Option<i64>,
    ) -> Result<i64, RepositoryError>;

    /// Retrieves historical telemetry for a specific therapy
    async fn get_therapy_history(
        &self,
        therapy_id: i64,
        limit: u32,
    ) -> Result<Vec<TelemetryReading>, RepositoryError>;

    /// Updates the therapy end timestamp for a therapy
    async fn set_therapy_end(&self, therapy_id: i64) -> Result<(), RepositoryError>;

    /// Creates a new serial session record.
    async fn create_serial_session(
        &self,
        machine_id: i64,
        patient_id_str: &str,
    ) -> Result<i64, RepositoryError>;

    /// Marks a serial session as ended.
    async fn end_serial_session(&self, session_id: i64) -> Result<(), RepositoryError>;

    /// Saves a batch of session (non-therapy) readings to session_readings table.
    async fn save_session_readings(
        &self,
        session_id: i64,
        readings: &[TelemetryReading],
        phase: &str,
    ) -> Result<(), RepositoryError>;

    /// Retrieves session readings for a given serial session.
    async fn get_session_readings(
        &self,
        session_id: i64,
        limit: u32,
    ) -> Result<Vec<TelemetryReading>, RepositoryError>;
}

/// Persists version information for caching/comparison.
pub trait VersionRepository: Send + Sync {
    async fn save(&self, version: &VersionInfo) -> Result<(), RepositoryError>;
    async fn save_initialization(
        &self,
        version: &VersionInfo,
        attrs: &[DataAttribute],
        dict_entries: &[DictionaryEntry],
    ) -> Result<(), RepositoryError>;
    async fn get_by_fingerprint(
        &self,
        fingerprint: &str,
    ) -> Result<Option<VersionInfo>, RepositoryError>;
}

/// CRUD for value equivalences (e.g., 0.0 = Preparation).
/// numeric_value is the physical/final value after applying the conversion factor.
pub trait AttributeEquivalenceRepository: Send + Sync {
    async fn save(&self, equiv: &AttributeEquivalence) -> Result<(), RepositoryError>;
    async fn save_batch(&self, equivs: &[AttributeEquivalence]) -> Result<(), RepositoryError>;
    async fn get_by_internal_name(
        &self,
        name: &str,
    ) -> Result<Vec<AttributeEquivalence>, RepositoryError>;
    async fn get_all(&self) -> Result<Vec<AttributeEquivalence>, RepositoryError>;
}

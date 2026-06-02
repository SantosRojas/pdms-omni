//! Enum-based dispatch wrappers that implement the domain repository traits
//! for both SQLite and MSSQL backends. This avoids the need for `dyn Trait`
//! which doesn't work with async trait methods in Rust 2024 edition.

use crate::domain::entities::{
    AttributeEquivalence, DataAttribute, DictionaryEntry, TelemetryReading, VersionInfo,
};
use crate::domain::repositories::{
    AttributeEquivalenceRepository, DataAttributeRepository, DictionaryRepository, RepositoryError,
    TelemetryRepository, VersionRepository,
};
use crate::infrastructure::mssql_repository::*;
use crate::infrastructure::null_repository::*;
use crate::infrastructure::postgres_repository::*;
use crate::infrastructure::sqlx_repository::*;

// ─── DataAttributeRepository ─────────────────────────
#[derive(Clone)]
pub enum DynAttrRepo {
    Sqlite(SqlxDataAttrRepository),
    Postgres(PgDataAttrRepository),
    Mssql(MssqlDataAttrRepository),
    Null(NullDataAttrRepository),
}

impl DataAttributeRepository for DynAttrRepo {
    async fn save(&self, attr: &DataAttribute) -> Result<(), RepositoryError> {
        match self {
            Self::Sqlite(r) => r.save(attr).await,
            Self::Postgres(r) => r.save(attr).await,
            Self::Mssql(r) => r.save(attr).await,
            Self::Null(r) => r.save(attr).await,
        }
    }
    async fn get_all(&self) -> Result<Vec<DataAttribute>, RepositoryError> {
        match self {
            Self::Sqlite(r) => r.get_all().await,
            Self::Postgres(r) => r.get_all().await,
            Self::Mssql(r) => r.get_all().await,
            Self::Null(r) => r.get_all().await,
        }
    }
    async fn get_by_handle(&self, handle: u16) -> Result<Option<DataAttribute>, RepositoryError> {
        match self {
            Self::Sqlite(r) => r.get_by_handle(handle).await,
            Self::Postgres(r) => r.get_by_handle(handle).await,
            Self::Mssql(r) => r.get_by_handle(handle).await,
            Self::Null(r) => r.get_by_handle(handle).await,
        }
    }
    async fn delete_all(&self) -> Result<(), RepositoryError> {
        match self {
            Self::Sqlite(r) => r.delete_all().await,
            Self::Postgres(r) => r.delete_all().await,
            Self::Mssql(r) => r.delete_all().await,
            Self::Null(r) => r.delete_all().await,
        }
    }
}

// ─── DictionaryRepository ────────────────────────────
#[derive(Clone)]
pub enum DynDictRepo {
    Sqlite(SqlxDictionaryRepository),
    Postgres(PgDictionaryRepository),
    Mssql(MssqlDictionaryRepository),
    Null(NullDictionaryRepository),
}

impl DictionaryRepository for DynDictRepo {
    async fn save(&self, entry: &DictionaryEntry) -> Result<(), RepositoryError> {
        match self {
            Self::Sqlite(r) => r.save(entry).await,
            Self::Postgres(r) => r.save(entry).await,
            Self::Mssql(r) => r.save(entry).await,
            Self::Null(r) => r.save(entry).await,
        }
    }
    async fn get_by_id(&self, dict_id: u16) -> Result<Option<DictionaryEntry>, RepositoryError> {
        match self {
            Self::Sqlite(r) => r.get_by_id(dict_id).await,
            Self::Postgres(r) => r.get_by_id(dict_id).await,
            Self::Mssql(r) => r.get_by_id(dict_id).await,
            Self::Null(r) => r.get_by_id(dict_id).await,
        }
    }
    async fn get_all(&self) -> Result<Vec<DictionaryEntry>, RepositoryError> {
        match self {
            Self::Sqlite(r) => r.get_all().await,
            Self::Postgres(r) => r.get_all().await,
            Self::Mssql(r) => r.get_all().await,
            Self::Null(r) => r.get_all().await,
        }
    }
    async fn delete_all(&self) -> Result<(), RepositoryError> {
        match self {
            Self::Sqlite(r) => r.delete_all().await,
            Self::Postgres(r) => r.delete_all().await,
            Self::Mssql(r) => r.delete_all().await,
            Self::Null(r) => r.delete_all().await,
        }
    }
}

// ─── TelemetryRepository ─────────────────────────────
#[derive(Clone)]
pub enum DynTelemetryRepo {
    Sqlite(SqlxTelemetryRepository),
    Postgres(PgTelemetryRepository),
    Mssql(MssqlTelemetryRepository),
    Null(NullTelemetryRepository),
}

impl TelemetryRepository for DynTelemetryRepo {
    async fn save(&self, reading: &TelemetryReading) -> Result<(), RepositoryError> {
        match self {
            Self::Sqlite(r) => r.save(reading).await,
            Self::Postgres(r) => r.save(reading).await,
            Self::Mssql(r) => r.save(reading).await,
            Self::Null(r) => r.save(reading).await,
        }
    }
    async fn save_batch(&self, readings: &[TelemetryReading]) -> Result<(), RepositoryError> {
        match self {
            Self::Sqlite(r) => r.save_batch(readings).await,
            Self::Postgres(r) => r.save_batch(readings).await,
            Self::Mssql(r) => r.save_batch(readings).await,
            Self::Null(r) => r.save_batch(readings).await,
        }
    }
    async fn get_recent_readings(
        &self,
        limit: u32,
    ) -> Result<Vec<TelemetryReading>, RepositoryError> {
        match self {
            Self::Sqlite(r) => r.get_recent_readings(limit).await,
            Self::Postgres(r) => r.get_recent_readings(limit).await,
            Self::Mssql(r) => r.get_recent_readings(limit).await,
            Self::Null(r) => r.get_recent_readings(limit).await,
        }
    }
    async fn get_or_create_machine(
        &self,
        serial_number: &str,
        software_version: &str,
    ) -> Result<i64, RepositoryError> {
        match self {
            Self::Sqlite(r) => {
                r.get_or_create_machine(serial_number, software_version)
                    .await
            }
            Self::Postgres(r) => {
                r.get_or_create_machine(serial_number, software_version)
                    .await
            }
            Self::Mssql(r) => {
                r.get_or_create_machine(serial_number, software_version)
                    .await
            }
            Self::Null(r) => {
                r.get_or_create_machine(serial_number, software_version)
                    .await
            }
        }
    }
    async fn get_or_create_patient(&self, patient_id_str: &str) -> Result<i64, RepositoryError> {
        match self {
            Self::Sqlite(r) => r.get_or_create_patient(patient_id_str).await,
            Self::Postgres(r) => r.get_or_create_patient(patient_id_str).await,
            Self::Mssql(r) => r.get_or_create_patient(patient_id_str).await,
            Self::Null(r) => r.get_or_create_patient(patient_id_str).await,
        }
    }
    async fn get_or_create_therapy(
        &self,
        patient_id: i64,
        machine_id: i64,
        started_at: &str,
        force_new: bool,
    ) -> Result<i64, RepositoryError> {
        match self {
            Self::Sqlite(r) => {
                r.get_or_create_therapy(patient_id, machine_id, started_at, force_new)
                    .await
            }
            Self::Postgres(r) => {
                r.get_or_create_therapy(patient_id, machine_id, started_at, force_new)
                    .await
            }
            Self::Mssql(r) => {
                r.get_or_create_therapy(patient_id, machine_id, started_at, force_new)
                    .await
            }
            Self::Null(r) => {
                r.get_or_create_therapy(patient_id, machine_id, started_at, force_new)
                    .await
            }
        }
    }
    async fn get_therapy_history(
        &self,
        therapy_id: i64,
        limit: u32,
    ) -> Result<Vec<TelemetryReading>, RepositoryError> {
        match self {
            Self::Sqlite(r) => r.get_therapy_history(therapy_id, limit).await,
            Self::Postgres(r) => r.get_therapy_history(therapy_id, limit).await,
            Self::Mssql(r) => r.get_therapy_history(therapy_id, limit).await,
            Self::Null(r) => r.get_therapy_history(therapy_id, limit).await,
        }
    }
    async fn set_therapy_end(&self, therapy_id: i64) -> Result<(), RepositoryError> {
        match self {
            Self::Sqlite(r) => r.set_therapy_end(therapy_id).await,
            Self::Postgres(r) => r.set_therapy_end(therapy_id).await,
            Self::Mssql(r) => r.set_therapy_end(therapy_id).await,
            Self::Null(r) => r.set_therapy_end(therapy_id).await,
        }
    }
}

// ─── VersionRepository ───────────────────────────────
#[derive(Clone)]
pub enum DynVersionRepo {
    Sqlite(SqlxVersionRepository),
    Postgres(PgVersionRepository),
    Mssql(MssqlVersionRepository),
    Null(NullVersionRepository),
}

impl VersionRepository for DynVersionRepo {
    async fn save(&self, version: &VersionInfo) -> Result<(), RepositoryError> {
        match self {
            Self::Sqlite(r) => r.save(version).await,
            Self::Postgres(r) => r.save(version).await,
            Self::Mssql(r) => r.save(version).await,
            Self::Null(r) => r.save(version).await,
        }
    }
    async fn get_latest(&self) -> Result<Option<VersionInfo>, RepositoryError> {
        match self {
            Self::Sqlite(r) => r.get_latest().await,
            Self::Postgres(r) => r.get_latest().await,
            Self::Mssql(r) => r.get_latest().await,
            Self::Null(r) => r.get_latest().await,
        }
    }
}

// ─── AttributeEquivalenceRepository ──────────────────
#[derive(Clone)]
pub enum DynEquivRepo {
    Sqlite(SqlxAttributeEquivalenceRepository),
    Postgres(PgAttributeEquivalenceRepository),
    Mssql(MssqlAttributeEquivalenceRepository),
    Null(NullAttributeEquivalenceRepository),
}

impl AttributeEquivalenceRepository for DynEquivRepo {
    async fn save(&self, equiv: &AttributeEquivalence) -> Result<(), RepositoryError> {
        match self {
            Self::Sqlite(r) => r.save(equiv).await,
            Self::Postgres(r) => r.save(equiv).await,
            Self::Mssql(r) => r.save(equiv).await,
            Self::Null(r) => r.save(equiv).await,
        }
    }
    async fn save_batch(&self, equivs: &[AttributeEquivalence]) -> Result<(), RepositoryError> {
        match self {
            Self::Sqlite(r) => r.save_batch(equivs).await,
            Self::Postgres(r) => r.save_batch(equivs).await,
            Self::Mssql(r) => r.save_batch(equivs).await,
            Self::Null(r) => r.save_batch(equivs).await,
        }
    }
    async fn get_by_internal_name(
        &self,
        name: &str,
    ) -> Result<Vec<AttributeEquivalence>, RepositoryError> {
        match self {
            Self::Sqlite(r) => r.get_by_internal_name(name).await,
            Self::Postgres(r) => r.get_by_internal_name(name).await,
            Self::Mssql(r) => r.get_by_internal_name(name).await,
            Self::Null(r) => r.get_by_internal_name(name).await,
        }
    }
    async fn get_all(&self) -> Result<Vec<AttributeEquivalence>, RepositoryError> {
        match self {
            Self::Sqlite(r) => r.get_all().await,
            Self::Postgres(r) => r.get_all().await,
            Self::Mssql(r) => r.get_all().await,
            Self::Null(r) => r.get_all().await,
        }
    }
}

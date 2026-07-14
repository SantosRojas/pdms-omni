//! Application layer: use cases / interactor.
//! Contains ALL business logic for the OMNI-ODI protocol.
//! This module ONLY depends on domain traits — never on infrastructure.

use chrono::Utc;
use thiserror::Error;

use crate::domain::device::{
    CMD_CODE_GET_CYCLICAL_VALUES, CMD_CODE_GET_DATA_ATTRS, CMD_CODE_GET_HANDLES,
    CMD_CODE_GET_NEXT_DICT_STR, CMD_CODE_GET_VERSIONS, CMD_CODE_NAK, DeviceCommunicator,
    VERSION_STRING_LENGTH,
};
use crate::domain::entities::{
    DataAttribute, DataType, DictionaryEntry, TelemetryReading, TelemetryValue, VersionInfo,
};
use crate::domain::repositories::{
    AttributeEquivalenceRepository, DataAttributeRepository, DictionaryRepository,
    TelemetryRepository, VersionRepository,
};

#[derive(Debug, Error)]
pub enum UseCaseError {
    #[error("Device error: {0}")]
    Device(#[from] crate::domain::device::DeviceError),
    #[error("Repository error: {0}")]
    Repository(#[from] crate::domain::repositories::RepositoryError),
    #[error("Protocol error: {0}")]
    Protocol(String),
}

/// Main orchestrator. Generic over all infrastructure implementations.
///
/// - `A`: DataAttributeRepository
/// - `Di`: DictionaryRepository
/// - `T`: TelemetryRepository
/// - `V`: VersionRepository
/// - `Dev`: DeviceCommunicator
pub struct OmniInteractor<A, Di, T, V, E, Dev> {
    attr_repo: A,
    dict_repo: Di,
    telemetry_repo: T,
    version_repo: V,
    equiv_repo: E,
    device: Dev,
    /// Ordered list of handles (as received from ANSW_GET_DATA_HANDLES).
    /// The cyclical values come in this exact order.
    handles: Vec<u16>,
    /// In-memory cache to avoid DB lookups during cyclical reading.
    attr_cache: std::collections::HashMap<u16, DataAttribute>,
    /// In-memory dictionary cache to avoid DB lookups.
    dict_cache: std::collections::HashMap<u16, String>,
    /// In-memory equivalence cache: internal_name -> numeric_value (as ordered bits) -> display_name.
    equiv_cache: std::collections::HashMap<String, std::collections::HashMap<u64, String>>,
}

impl<A, Di, T, V, E, Dev> OmniInteractor<A, Di, T, V, E, Dev>
where
    A: DataAttributeRepository,
    Di: DictionaryRepository,
    T: TelemetryRepository,
    V: VersionRepository,
    E: AttributeEquivalenceRepository,
    Dev: DeviceCommunicator,
{
    pub fn new(
        attr_repo: A,
        dict_repo: Di,
        telemetry_repo: T,
        version_repo: V,
        equiv_repo: E,
        device: Dev,
    ) -> Self {
        Self {
            attr_repo,
            dict_repo,
            telemetry_repo,
            version_repo,
            equiv_repo,
            device,
            handles: Vec::new(),
            attr_cache: std::collections::HashMap::new(),
            dict_cache: std::collections::HashMap::new(),
            equiv_cache: std::collections::HashMap::new(),
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  PHASE 1: IDENTIFICATION — Get Version Numbers
    // ═══════════════════════════════════════════════════════════════
    /// Sends CMD_CODE_GET_VERSIONS and parses the answer.
    ///
    /// Answer format (after cmd_code u16):
    ///   [lang_id: u16]
    ///   [system_sw: 16 bytes][dss_fw: 16][dss_hw: 16][css_fw: 16][css_hw: 16]
    ///   [pss_fw: 16][pss_hw: 16]
    ///   [lang1: 16][lang2: 16][lang3: 16]
    pub async fn get_versions(&mut self) -> Result<VersionInfo, UseCaseError> {
        println!("  [1] CMD_GET_VERSIONS (code={})", CMD_CODE_GET_VERSIONS);
        let data = self.device.request(CMD_CODE_GET_VERSIONS, &[])?;

        // First 2 bytes = echoed command code
        if data.len() < 2 {
            return Err(UseCaseError::Protocol(
                "Response too short for versions".into(),
            ));
        }
        let resp_cmd = u16::from_le_bytes(data[0..2].try_into().unwrap());
        if resp_cmd == CMD_CODE_NAK {
            let err_code = if data.len() >= 4 {
                u16::from_le_bytes(data[2..4].try_into().unwrap())
            } else {
                0
            };
            return Err(UseCaseError::Device(
                crate::domain::device::DeviceError::Nak(err_code),
            ));
        }

        // Minimum expected: cmd(2) + lang_id(2) + 7 version strings(7*16) + 3 language strings(3*16)
        let expected_len = 2 + 2 + (7 * VERSION_STRING_LENGTH) + (3 * VERSION_STRING_LENGTH);
        if data.len() < expected_len {
            return Err(UseCaseError::Protocol(format!(
                "Versions response too short: {} bytes, expected >= {}",
                data.len(),
                expected_len
            )));
        }

        let language_id = u16::from_le_bytes(data[2..4].try_into().unwrap());

        let read_version = |offset: usize| -> String {
            let slice = &data[offset..offset + VERSION_STRING_LENGTH];
            let text = if let Some(null_pos) = slice.iter().position(|&b| b == 0) {
                String::from_utf8_lossy(&slice[..null_pos])
            } else {
                String::from_utf8_lossy(slice)
            };
            text.trim().to_string()
        };

        let base = 4; // after cmd(2) + lang_id(2)
        let version = VersionInfo {
            language_id,
            system_sw: read_version(base),
            dss_fw: read_version(base + 16),
            dss_hw: read_version(base + 32),
            css_fw: read_version(base + 48),
            css_hw: read_version(base + 64),
            pss_fw: read_version(base + 80),
            pss_hw: read_version(base + 96),
            language1: read_version(base + 112),
            language2: read_version(base + 128),
            language3: read_version(base + 144),
        };

        println!("      System SW: {}", version.system_sw);
        println!("      DSS FW:    {}", version.dss_fw);
        println!(
            "      Language:   {} (id={})",
            version.language1, version.language_id
        );

        Ok(version)
    }

    // ═══════════════════════════════════════════════════════════════
    //  PHASE 2a: INITIALIZATION — Get Data Handles
    // ═══════════════════════════════════════════════════════════════
    /// Sends CMD_CODE_GET_HANDLES. Answer:
    ///   [cmd: u16][num_handles: u16][handle_1: u16][handle_2: u16]...[handle_n: u16]
    pub async fn get_data_handles(&mut self) -> Result<Vec<u16>, UseCaseError> {
        println!("  [2] CMD_GET_HANDLES (code={})", CMD_CODE_GET_HANDLES);
        let data = self.device.request(CMD_CODE_GET_HANDLES, &[])?;

        if data.len() < 4 {
            return Err(UseCaseError::Protocol("Handles response too short".into()));
        }

        let resp_cmd = u16::from_le_bytes(data[0..2].try_into().unwrap());
        if resp_cmd == CMD_CODE_NAK {
            let err_code = if data.len() >= 4 {
                u16::from_le_bytes(data[2..4].try_into().unwrap())
            } else {
                0
            };
            return Err(UseCaseError::Device(
                crate::domain::device::DeviceError::Nak(err_code),
            ));
        }

        let num_handles = u16::from_le_bytes(data[2..4].try_into().unwrap()) as usize;
        let expected_len = 4 + num_handles * 2;

        if data.len() < expected_len {
            return Err(UseCaseError::Protocol(format!(
                "Expected {} bytes for {} handles, got {}",
                expected_len,
                num_handles,
                data.len()
            )));
        }

        let mut handles = Vec::with_capacity(num_handles);
        for i in 0..num_handles {
            let offset = 4 + i * 2;
            let handle = u16::from_le_bytes(data[offset..offset + 2].try_into().unwrap());
            handles.push(handle);
        }

        self.handles = handles.clone();
        println!("      Received {} handle(s)", handles.len());

        Ok(handles)
    }

    // ═══════════════════════════════════════════════════════════════
    //  PHASE 2b: INITIALIZATION — Get Data Attributes (per handle)
    // ═══════════════════════════════════════════════════════════════
    /// Gets attributes for ALL handles previously discovered.
    pub async fn get_all_data_attributes(
        &mut self,
        _version_fingerprint: &str,
    ) -> Result<Vec<DataAttribute>, UseCaseError> {
        let handles = self.handles.clone();
        println!(
            "  [3] CMD_GET_DATA_ATTRS for {} handle(s)...",
            handles.len()
        );

        let mut attrs = Vec::with_capacity(handles.len());
        self.attr_cache.clear();

        for (i, &handle) in handles.iter().enumerate() {
            let data = {
                let handle_bytes = handle.to_le_bytes();
                self.device
                    .request(CMD_CODE_GET_DATA_ATTRS, &handle_bytes)?
            };

            if data.len() < 12 {
                return Err(UseCaseError::Protocol(
                    "Data attrs response too short".into(),
                ));
            }

            let resp_cmd = u16::from_le_bytes(data[0..2].try_into().unwrap());
            if resp_cmd == CMD_CODE_NAK {
                let err_code = if data.len() >= 4 {
                    u16::from_le_bytes(data[2..4].try_into().unwrap())
                } else {
                    0
                };
                return Err(UseCaseError::Device(
                    crate::domain::device::DeviceError::Nak(err_code),
                ));
            }

            let data_type = DataType::from(u16::from_le_bytes(data[2..4].try_into().unwrap()));
            let size = u16::from_le_bytes(data[4..6].try_into().unwrap());
            let factor = u16::from_le_bytes(data[6..8].try_into().unwrap());
            let label_did = u16::from_le_bytes(data[8..10].try_into().unwrap());
            let unit_did = u16::from_le_bytes(data[10..12].try_into().unwrap());

            let name_bytes = &data[12..];
            let internal_name = if let Some(null_pos) = name_bytes.iter().position(|&b| b == 0) {
                String::from_utf8_lossy(&name_bytes[..null_pos]).to_string()
            } else {
                String::from_utf8_lossy(name_bytes).trim().to_string()
            };

            let attr = DataAttribute {
                handle,
                data_type,
                size,
                conversion_factor: factor,
                label_did,
                unit_did,
                signal_id: 0,
                internal_name,
            };

            println!(
                "      [{}/{}] handle=0x{:04X} name={:30} type={:?} size={} factor={}",
                i + 1,
                handles.len(),
                handle,
                attr.internal_name,
                attr.data_type,
                attr.size,
                attr.conversion_factor
            );
            self.attr_cache.insert(handle, attr.clone());
            attrs.push(attr);
        }

        Ok(attrs)
    }

    // ═══════════════════════════════════════════════════════════════
    //  PHASE 2c: INITIALIZATION — Get Dictionary Strings
    // ═══════════════════════════════════════════════════════════════
    /// Iteratively fetches the entire dictionary using CMD_CODE_GET_NEXT_DICT_STR.
    ///
    /// Command: [cmd: u16][prev_dict_id: u16]
    /// Answer:  [cmd: u16][dict_id: u16][utf8_string...\0]
    ///
    /// Start with prev_dict_id=0. When dict_id in answer == 0, dictionary is complete.
    pub async fn get_dictionary(
        &mut self,
        _version_fingerprint: &str,
    ) -> Result<Vec<DictionaryEntry>, UseCaseError> {
        println!("  [4] CMD_GET_NEXT_DICT_STR (building dictionary)...");

        const MAX_DICT_ENTRIES: usize = 20_000;
        let mut entries = Vec::new();
        self.dict_cache.clear();
        let mut prev_id: u16 = 0;
        let mut seen_ids = std::collections::HashSet::new();

        loop {
            let id_bytes = prev_id.to_le_bytes();

            let data = self.device.request(CMD_CODE_GET_NEXT_DICT_STR, &id_bytes)?;

            if data.len() < 4 {
                return Err(UseCaseError::Protocol(
                    "Dictionary response too short".into(),
                ));
            }

            let resp_cmd = u16::from_le_bytes(data[0..2].try_into().unwrap());
            if resp_cmd == CMD_CODE_NAK {
                let err_code = if data.len() >= 4 {
                    u16::from_le_bytes(data[2..4].try_into().unwrap())
                } else {
                    0
                };
                return Err(UseCaseError::Device(
                    crate::domain::device::DeviceError::Nak(err_code),
                ));
            }

            let dict_id = u16::from_le_bytes(data[2..4].try_into().unwrap());

            // dict_id == 0 means end of dictionary
            if dict_id == 0 {
                break;
            }

            if !seen_ids.insert(dict_id) {
                return Err(UseCaseError::Protocol(format!(
                    "Dictionary loop detected: repeated dict_id={} after {} entries",
                    dict_id,
                    entries.len()
                )));
            }

            // String starts at offset 4, null-terminated UTF-8
            let str_bytes = &data[4..];
            let text = if let Some(null_pos) = str_bytes.iter().position(|&b| b == 0) {
                String::from_utf8_lossy(&str_bytes[..null_pos]).to_string()
            } else {
                String::from_utf8_lossy(str_bytes).to_string()
            };

            let entry = DictionaryEntry {
                dict_id,
                text: text.clone(),
            };
            self.dict_cache.insert(dict_id, text.clone());
            entries.push(entry);

            if entries.len() % 200 == 0 {
                println!(
                    "      ... dictionary progress: {} entries (last dict_id={})",
                    entries.len(),
                    dict_id
                );
            }

            if entries.len() >= MAX_DICT_ENTRIES {
                return Err(UseCaseError::Protocol(format!(
                    "Dictionary exceeded safety limit ({} entries)",
                    MAX_DICT_ENTRIES
                )));
            }

            prev_id = dict_id;
        }

        println!("      Dictionary complete: {} entries", entries.len());
        Ok(entries)
    }

    // ═══════════════════════════════════════════════════════════════
    //  PHASE 3: CYCLICAL — Get Cyclical Values
    // ═══════════════════════════════════════════════════════════════
    /// Sends CMD_CODE_GET_CYCLICAL_VALUES. Answer:
    ///   [cmd: u16][byte_1][byte_2]...[byte_n]
    ///
    /// The byte flow represents values in the SAME ORDER as the handles.
    /// We use the 'size' attribute of each handle to split the byte stream.
    /// Values are divided by 'conversion_factor' to get the physical value.
    pub async fn get_cyclical_values(&mut self) -> Result<Vec<TelemetryReading>, UseCaseError> {
        self.get_cyclical_values_filtered(|_| true).await
    }

    /// Same as `get_cyclical_values`, but allowing runtime filtering.
    /// Return and persistence include only readings where `include_reading` is true.
    pub async fn get_cyclical_values_filtered<F>(
        &mut self,
        include_reading: F,
    ) -> Result<Vec<TelemetryReading>, UseCaseError>
    where
        F: Fn(&DataAttribute) -> bool,
    {
        let data = self.device.request(CMD_CODE_GET_CYCLICAL_VALUES, &[])?;

        if data.len() < 2 {
            return Err(UseCaseError::Protocol("Cyclical response too short".into()));
        }

        let resp_cmd = u16::from_le_bytes(data[0..2].try_into().unwrap());
        if resp_cmd == CMD_CODE_NAK {
            let err_code = if data.len() >= 4 {
                u16::from_le_bytes(data[2..4].try_into().unwrap())
            } else {
                0
            };
            return Err(UseCaseError::Device(
                crate::domain::device::DeviceError::Nak(err_code),
            ));
        }

        // Use the in-memory cache directly for performance (avoids N+1 DB queries)
        let attr_map = &self.attr_cache;

        let values_data = &data[2..]; // skip cmd code
        let mut offset = 0;
        let mut readings = Vec::new();
        let mut patient_id_text: Option<String> = None;

        for &handle in &self.handles {
            let attr = match attr_map.get(&handle) {
                Some(a) => a,
                None => {
                    eprintln!("      ⚠ No attribute for handle 0x{:04X}, skipping", handle);
                    continue;
                }
            };

            let size = attr.size as usize;
            if offset + size > values_data.len() {
                eprintln!(
                    "      ⚠ Insufficient data at offset {} for '{}' (need {} bytes)",
                    offset, attr.internal_name, size
                );
                break;
            }

            let slice = &values_data[offset..offset + size];
            let raw_value = Self::read_raw_value(slice, size, attr.data_type);

            let physical_value = match attr.data_type {
                DataType::DiaString | DataType::VersionString => {
                    // Read string until null terminator
                    let text = if let Some(null_pos) = slice.iter().position(|&b| b == 0) {
                        String::from_utf8_lossy(&slice[..null_pos])
                    } else {
                        String::from_utf8_lossy(slice)
                    };
                    TelemetryValue::String(text.trim().to_string())
                }
                _ => {
                    if attr.conversion_factor > 0 {
                        TelemetryValue::Number(raw_value as f64 / attr.conversion_factor as f64)
                    } else {
                        TelemetryValue::Number(raw_value as f64)
                    }
                }
            };

            // Lookup unit string from in-memory dictionary cache, fallback to DB
            let unit = match self.dict_cache.get(&attr.unit_did) {
                Some(u) => u.clone(),
                None => {
                    // Cache miss (happens when loaded from DB without a get_all dictionary hook)
                    // Fetch from DB and insert into cache
                    let text = self
                        .dict_repo
                        .get_by_id(attr.unit_did)
                        .await?
                        .map(|e| e.text)
                        .unwrap_or_default();
                    self.dict_cache.insert(attr.unit_did, text.clone());
                    text
                }
            };

            // Lookup display equivalence using physical_value
            let display_value = if let TelemetryValue::Number(n) = &physical_value {
                let key = n.to_bits();
                self.equiv_cache
                    .get(&attr.internal_name)
                    .and_then(|m| m.get(&key))
                    .cloned()
            } else {
                None
            };

            // Always extract patient ID regardless of whether it's included in the filtered readings
            if attr.internal_name == "g_patient_id_str"
                && let TelemetryValue::String(ref s) = physical_value
            {
                patient_id_text = Some(s.clone());
            }

            if include_reading(attr) {
                readings.push(TelemetryReading {
                    id: None,
                    timestamp: Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                    therapy_id: None,
                    serial_session_id: None,
                    signal_id: attr.signal_id,
                    internal_name: attr.internal_name.clone(),
                    raw_value,
                    physical_value,
                    unit,
                    display_value,
                    phase: None,
                });
            }

            offset += size;
        }

        // 2. Resolve patient ID
        let patient_str = patient_id_text
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| "UNKNOWN".to_string());

        let _db_patient_id = self
            .telemetry_repo
            .get_or_create_patient(&patient_str)
            .await?;

        Ok(readings)
    }

    /// Explicitly save a batch of telemetry readings.
    pub async fn save_telemetry(&self, readings: &[TelemetryReading]) -> Result<(), UseCaseError> {
        self.telemetry_repo.save_batch(readings).await?;
        Ok(())
    }

    pub async fn get_or_create_patient(&self, patient_id_str: &str) -> Result<i64, UseCaseError> {
        Ok(self
            .telemetry_repo
            .get_or_create_patient(patient_id_str)
            .await?)
    }

    pub async fn get_or_create_machine(
        &self,
        serial_number: &str,
        software_version: &str,
    ) -> Result<i64, UseCaseError> {
        Ok(self
            .telemetry_repo
            .get_or_create_machine(serial_number, software_version)
            .await?)
    }

    pub async fn get_or_create_therapy(
        &self,
        patient_id: i64,
        machine_id: i64,
        started_at: &str,
        force_new: bool,
        serial_session_id: Option<i64>,
    ) -> Result<i64, UseCaseError> {
        Ok(self
            .telemetry_repo
            .get_or_create_therapy(
                patient_id,
                machine_id,
                started_at,
                force_new,
                serial_session_id,
            )
            .await?)
    }

    pub async fn end_therapy(&self, therapy_id: i64) -> Result<(), UseCaseError> {
        self.telemetry_repo.set_therapy_end(therapy_id).await?;
        Ok(())
    }

    pub async fn create_serial_session(
        &self,
        machine_id: i64,
        patient_id_str: &str,
    ) -> Result<i64, UseCaseError> {
        Ok(self
            .telemetry_repo
            .create_serial_session(machine_id, patient_id_str)
            .await?)
    }

    pub async fn end_serial_session(&self, session_id: i64) -> Result<(), UseCaseError> {
        self.telemetry_repo.end_serial_session(session_id).await?;
        Ok(())
    }

    pub async fn save_session_readings(
        &self,
        session_id: i64,
        readings: &[TelemetryReading],
        phase: &str,
    ) -> Result<(), UseCaseError> {
        self.telemetry_repo
            .save_session_readings(session_id, readings, phase)
            .await?;
        Ok(())
    }

    #[allow(dead_code)]
    pub async fn get_session_readings(
        &self,
        session_id: i64,
        limit: u32,
    ) -> Result<Vec<TelemetryReading>, UseCaseError> {
        Ok(self
            .telemetry_repo
            .get_session_readings(session_id, limit)
            .await?)
    }

    // ═══════════════════════════════════════════════════════════════
    //  FULL INITIALIZATION (convenience)
    // ═══════════════════════════════════════════════════════════════
    /// Runs the complete initialization sequence as per the protocol spec:
    /// 1. Get versions from OMNI and compute a fingerprint.
    /// 2. Query the DB for cached configuration by fingerprint.
    /// 3. If cached, load handles, attributes, and dictionary from DB.
    /// 4. If not cached, request all data from OMNI and store with the fingerprint.
    pub async fn initialize(&mut self) -> Result<VersionInfo, UseCaseError> {
        println!("\n══ PHASE: IDENTIFICATION ══");
        let version = self.get_versions().await?;
        let fp = version.fingerprint();

        let cached_version = self.version_repo.get_by_fingerprint(&fp).await?;

        println!("\n══ PHASE: INITIALIZATION ══");

        if cached_version.is_some() {
            println!(
                "  [i] Fingerprint {} matched in DB. Loading from database...",
                fp
            );
            let loaded = self.load_configuration_from_db(&fp).await?;
            if loaded {
                println!("  [i] Cache hit. Skipping device fetch. Moving to cyclic loop.");
                println!("  [eq] Loading value equivalences from database...");
                self.load_equiv_cache().await?;
                println!("\n══ INITIALIZATION COMPLETE ══\n");
                return Ok(version);
            }
            println!("  [i] Database cache is empty/incomplete. Fetching from device...");
        } else {
            println!(
                "  [i] Fingerprint {} is new (not found in DB). Fetching from device...",
                fp
            );
        }

        // Fetch from device (memory only — no DB writes yet)
        self.get_data_handles().await?;
        let attrs = self.get_all_data_attributes(&fp).await?;
        let dict = self.get_dictionary(&fp).await?;

        // Persist everything atomically — if this fails, nothing is committed
        self.version_repo
            .save_initialization(&version, &attrs, &dict)
            .await?;

        // Reload the in-memory cache from DB (gets real signal_ids from DB)
        self.load_configuration_from_db(&fp).await?;

        println!("  [eq] Loading value equivalences from database...");
        self.load_equiv_cache().await?;

        println!("\n══ INITIALIZATION COMPLETE ══\n");
        Ok(version)
    }

    /// Loads the data handles, data attributes, and dictionary directly from the DB
    /// into the in-memory caches, bypassing the serial communication.
    async fn load_configuration_from_db(&mut self, fp: &str) -> Result<bool, UseCaseError> {
        // Load data attributes from DB (scoped to fingerprint)
        let attrs = self.attr_repo.get_by_fingerprint(fp).await?;
        self.attr_cache.clear();
        self.handles.clear();

        for attr in &attrs {
            self.handles.push(attr.handle);
            self.attr_cache.insert(attr.handle, attr.clone());
        }
        println!(
            "      Loaded {} attribute(s) from DB (fp={}).",
            self.handles.len(),
            fp
        );
        if self.handles.is_empty() {
            return Ok(false);
        }

        let dict_entries = self.dict_repo.get_by_fingerprint(fp).await?;
        self.dict_cache.clear();
        for entry in dict_entries {
            self.dict_cache.insert(entry.dict_id, entry.text);
        }
        println!(
            "      Loaded {} dictionary entries from DB (fp={}).",
            self.dict_cache.len(),
            fp
        );
        if self.dict_cache.is_empty() {
            return Ok(false);
        }

        Ok(true)
    }

    /// Loads value equivalences from the DB into the in-memory cache.
    /// Called unconditionally after initialization so both code paths
    /// (fresh device fetch and DB cache load) benefit from it.
    async fn load_equiv_cache(&mut self) -> Result<(), UseCaseError> {
        let equivs = self.equiv_repo.get_all().await?;
        self.equiv_cache.clear();
        for eq in equivs {
            self.equiv_cache
                .entry(eq.internal_name)
                .or_default()
                .insert(eq.numeric_value.to_bits(), eq.display_name);
        }
        println!(
            "      {} equivalence value(s) loaded across {} signal(s).",
            self.equiv_cache.values().map(|m| m.len()).sum::<usize>(),
            self.equiv_cache.len()
        );
        Ok(())
    }

    // ───────────────────────────────────────────────
    //  Helper: read a raw integer value from bytes
    // ───────────────────────────────────────────────
    fn read_raw_value(bytes: &[u8], size: usize, data_type: DataType) -> i64 {
        let is_signed = matches!(
            data_type,
            DataType::InputNumberSigned | DataType::OutputNumberSigned
        );

        match size {
            1 => {
                if is_signed {
                    bytes[0] as i8 as i64
                } else {
                    bytes[0] as i64
                }
            }
            2 => {
                let val = u16::from_le_bytes(bytes[..2].try_into().unwrap());
                if is_signed {
                    val as i16 as i64
                } else {
                    val as i64
                }
            }
            4 => {
                let val = u32::from_le_bytes(bytes[..4].try_into().unwrap());
                if is_signed {
                    val as i32 as i64
                } else {
                    val as i64
                }
            }
            _ => {
                // For strings or unusual sizes, return first 2 bytes as u16
                if size >= 2 {
                    u16::from_le_bytes(bytes[..2].try_into().unwrap()) as i64
                } else if !bytes.is_empty() {
                    bytes[0] as i64
                } else {
                    0
                }
            }
        }
    }
}

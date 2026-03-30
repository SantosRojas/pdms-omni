//! Application layer: use cases / interactor.
//! Contains ALL business logic for the OMNI-ODI protocol.
//! This module ONLY depends on domain traits — never on infrastructure.

use byteorder::{ByteOrder, LittleEndian};
use thiserror::Error;

use crate::domain::device::{
    DeviceCommunicator,
    CMD_CODE_GET_VERSIONS, CMD_CODE_GET_HANDLES, CMD_CODE_GET_DATA_ATTRS,
    CMD_CODE_GET_NEXT_DICT_STR, CMD_CODE_GET_CYCLICAL_VALUES, CMD_CODE_NAK,
    VERSION_STRING_LENGTH,
};
use crate::domain::entities::{
    DataAttribute, DataType, DictionaryEntry, TelemetryReading, TelemetryValue, VersionInfo,
};
use crate::domain::repositories::{
    AttributeEquivalenceRepository, DataAttributeRepository, DictionaryRepository, TelemetryRepository, VersionRepository,
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
    pub fn new(attr_repo: A, dict_repo: Di, telemetry_repo: T, version_repo: V, equiv_repo: E, device: Dev) -> Self {
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
            return Err(UseCaseError::Protocol("Response too short for versions".into()));
        }
        let resp_cmd = LittleEndian::read_u16(&data[0..2]);
        if resp_cmd == CMD_CODE_NAK {
            let err_code = if data.len() >= 4 { LittleEndian::read_u16(&data[2..4]) } else { 0 };
            return Err(UseCaseError::Device(crate::domain::device::DeviceError::Nak(err_code)));
        }

        // Minimum expected: cmd(2) + lang_id(2) + 7 version strings(7*16) + 3 language strings(3*16)
        let expected_len = 2 + 2 + (7 * VERSION_STRING_LENGTH) + (3 * VERSION_STRING_LENGTH);
        if data.len() < expected_len {
            return Err(UseCaseError::Protocol(format!(
                "Versions response too short: {} bytes, expected >= {}",
                data.len(), expected_len
            )));
        }

        let language_id = LittleEndian::read_u16(&data[2..4]);

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
            dss_fw:    read_version(base + 16),
            dss_hw:    read_version(base + 32),
            css_fw:    read_version(base + 48),
            css_hw:    read_version(base + 64),
            pss_fw:    read_version(base + 80),
            pss_hw:    read_version(base + 96),
            language1: read_version(base + 112),
            language2: read_version(base + 128),
            language3: read_version(base + 144),
        };

        println!("      System SW: {}", version.system_sw);
        println!("      DSS FW:    {}", version.dss_fw);
        println!("      Language:   {} (id={})", version.language1, version.language_id);

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

        let resp_cmd = LittleEndian::read_u16(&data[0..2]);
        if resp_cmd == CMD_CODE_NAK {
            let err_code = if data.len() >= 4 { LittleEndian::read_u16(&data[2..4]) } else { 0 };
            return Err(UseCaseError::Device(crate::domain::device::DeviceError::Nak(err_code)));
        }

        let num_handles = LittleEndian::read_u16(&data[2..4]) as usize;
        let expected_len = 4 + num_handles * 2;

        if data.len() < expected_len {
            return Err(UseCaseError::Protocol(format!(
                "Expected {} bytes for {} handles, got {}",
                expected_len, num_handles, data.len()
            )));
        }

        let mut handles = Vec::with_capacity(num_handles);
        for i in 0..num_handles {
            let offset = 4 + i * 2;
            let handle = LittleEndian::read_u16(&data[offset..offset + 2]);
            handles.push(handle);
        }

        self.handles = handles.clone();
        println!("      Received {} handle(s)", handles.len());

        Ok(handles)
    }

    // ═══════════════════════════════════════════════════════════════
    //  PHASE 2b: INITIALIZATION — Get Data Attributes (per handle)
    // ═══════════════════════════════════════════════════════════════
    /// Sends CMD_CODE_GET_DATA_ATTRS for a single handle. Answer:
    ///   [cmd: u16][type: u16][size: u16][factor: u16]
    ///   [label_did: u16][unit_did: u16][internal_name: null-terminated ASCII, max 64+1]
    pub async fn get_data_attributes(&mut self, handle: u16) -> Result<DataAttribute, UseCaseError> {
        let mut handle_bytes = [0u8; 2];
        LittleEndian::write_u16(&mut handle_bytes, handle);

        let data = self.device.request(CMD_CODE_GET_DATA_ATTRS, &handle_bytes)?;

        if data.len() < 12 {
            return Err(UseCaseError::Protocol("Data attrs response too short".into()));
        }

        let resp_cmd = LittleEndian::read_u16(&data[0..2]);
        if resp_cmd == CMD_CODE_NAK {
            let err_code = if data.len() >= 4 { LittleEndian::read_u16(&data[2..4]) } else { 0 };
            return Err(UseCaseError::Device(crate::domain::device::DeviceError::Nak(err_code)));
        }

        let data_type   = DataType::from(LittleEndian::read_u16(&data[2..4]));
        let size        = LittleEndian::read_u16(&data[4..6]);
        let factor      = LittleEndian::read_u16(&data[6..8]);
        let label_did   = LittleEndian::read_u16(&data[8..10]);
        let unit_did    = LittleEndian::read_u16(&data[10..12]);

        // Internal name: null-terminated ASCII string starting at offset 12
        let name_bytes = &data[12..];
        let internal_name = if let Some(null_pos) = name_bytes.iter().position(|&b| b == 0) {
            String::from_utf8_lossy(&name_bytes[..null_pos]).to_string()
        } else {
            String::from_utf8_lossy(name_bytes).trim().to_string()
        };

        let mut attr = DataAttribute {
            handle,
            data_type,
            size,
            conversion_factor: factor,
            label_did,
            unit_did,
            signal_id: 0, // Will be populated by the DB
            internal_name,
        };

        self.attr_repo.save(&attr).await?;
        
        // Reload from DB to get the generated signal_id
        if let Some(saved_attr) = self.attr_repo.get_by_handle(handle).await? {
            attr = saved_attr;
        }

        self.attr_cache.insert(handle, attr.clone());
        Ok(attr)
    }

    /// Gets attributes for ALL handles previously discovered.
    pub async fn get_all_data_attributes(&mut self) -> Result<Vec<DataAttribute>, UseCaseError> {
        let handles = self.handles.clone();
        println!("  [3] CMD_GET_DATA_ATTRS for {} handle(s)...", handles.len());

        self.attr_repo.delete_all().await?;
        let mut attrs = Vec::with_capacity(handles.len());
        self.attr_cache.clear();

        for (i, &handle) in handles.iter().enumerate() {
            let attr = self.get_data_attributes(handle).await?;
            println!("      [{}/{}] handle=0x{:04X} name={:30} type={:?} size={} factor={}",
                i + 1, handles.len(), handle, attr.internal_name,
                attr.data_type, attr.size, attr.conversion_factor);
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
    pub async fn get_dictionary(&mut self) -> Result<Vec<DictionaryEntry>, UseCaseError> {
        println!("  [4] CMD_GET_NEXT_DICT_STR (building dictionary)...");

        const MAX_DICT_ENTRIES: usize = 20_000;
        self.dict_repo.delete_all().await?;
        let mut entries = Vec::new();
        self.dict_cache.clear();
        let mut prev_id: u16 = 0;
        let mut seen_ids = std::collections::HashSet::new();

        loop {
            let mut id_bytes = [0u8; 2];
            LittleEndian::write_u16(&mut id_bytes, prev_id);

            let data = self.device.request(CMD_CODE_GET_NEXT_DICT_STR, &id_bytes)?;

            if data.len() < 4 {
                return Err(UseCaseError::Protocol("Dictionary response too short".into()));
            }

            let resp_cmd = LittleEndian::read_u16(&data[0..2]);
            if resp_cmd == CMD_CODE_NAK {
                let err_code = if data.len() >= 4 { LittleEndian::read_u16(&data[2..4]) } else { 0 };
                return Err(UseCaseError::Device(crate::domain::device::DeviceError::Nak(err_code)));
            }

            let dict_id = LittleEndian::read_u16(&data[2..4]);

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
            self.dict_repo.save(&entry).await?;
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
    pub async fn get_cyclical_values_filtered<F>(&mut self, include_reading: F) -> Result<Vec<TelemetryReading>, UseCaseError>
    where
        F: Fn(&DataAttribute) -> bool,
    {
        let data = self.device.request(CMD_CODE_GET_CYCLICAL_VALUES, &[])?;

        if data.len() < 2 {
            return Err(UseCaseError::Protocol("Cyclical response too short".into()));
        }

        let resp_cmd = LittleEndian::read_u16(&data[0..2]);
        if resp_cmd == CMD_CODE_NAK {
            let err_code = if data.len() >= 4 { LittleEndian::read_u16(&data[2..4]) } else { 0 };
            return Err(UseCaseError::Device(crate::domain::device::DeviceError::Nak(err_code)));
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
                eprintln!("      ⚠ Insufficient data at offset {} for '{}' (need {} bytes)",
                    offset, attr.internal_name, size);
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
                    let text = self.dict_repo
                        .get_by_id(attr.unit_did).await?
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
            if attr.internal_name == "g_patient_id_str" {
                if let TelemetryValue::String(ref s) = physical_value {
                    patient_id_text = Some(s.clone());
                }
            }

            if include_reading(attr) {
                readings.push(TelemetryReading {
                    id: None,
                    timestamp: String::new(), // DB sets CURRENT_TIMESTAMP
                    patient_id: None,         // populated below
                    signal_id: attr.signal_id,
                    internal_name: attr.internal_name.clone(),
                    raw_value,
                    physical_value,
                    unit,
                    display_value,
                });
            }

            offset += size;
        }

        // 2. Resolve patient ID
        let patient_str = patient_id_text
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| "UNKNOWN".to_string());
            
        let db_patient_id = self.telemetry_repo.get_or_create_patient(&patient_str).await?;

        for reading in &mut readings {
            reading.patient_id = Some(db_patient_id);
        }

        Ok(readings)
    }

    /// Explicitly save a batch of telemetry readings.
    pub async fn save_telemetry(&self, readings: &[TelemetryReading]) -> Result<(), UseCaseError> {
        self.telemetry_repo.save_batch(readings).await?;
        Ok(())
    }

    pub async fn start_therapy(&self, patient_id: i64) -> Result<(), UseCaseError> {
        self.telemetry_repo.set_therapy_start(patient_id).await?;
        Ok(())
    }

    pub async fn end_therapy(&self, patient_id: i64) -> Result<(), UseCaseError> {
        self.telemetry_repo.set_therapy_end(patient_id).await?;
        Ok(())
    }

    // ═══════════════════════════════════════════════════════════════
    //  FULL INITIALIZATION (convenience)
    // ═══════════════════════════════════════════════════════════════
    /// Runs the complete initialization sequence as per the protocol spec:
    /// 1. Get versions from OMNI.
    /// 2. Compare with stored version.
    /// 3. If versions match, load handles, attributes, and dictionary from DB.
    /// 4. If versions differ, request all data from OMNI and store in DB.
    pub async fn initialize(&mut self) -> Result<VersionInfo, UseCaseError> {
        println!("\n══ PHASE: IDENTIFICATION ══");
        let latest_db_version = self.version_repo.get_latest().await?;
        let version = self.get_versions().await?;

        // Compare the combination of SW, HW and Language versions
        let versions_match = match latest_db_version {
            Some(db_v) => {
                db_v.system_sw == version.system_sw &&
                db_v.dss_fw == version.dss_fw &&
                db_v.dss_hw == version.dss_hw &&
                db_v.css_fw == version.css_fw &&
                db_v.css_hw == version.css_hw &&
                db_v.language_id == version.language_id
            },
            None => false,
        };

        println!("\n══ PHASE: INITIALIZATION ══");

        if versions_match {
            println!("  [i] Versions match. Loading configuration from database...");
            let loaded = self.load_configuration_from_db().await?;
            if !loaded {
                println!("  [i] Database cache is empty/incomplete. Fetching from device...");
                self.get_data_handles().await?;
                self.get_all_data_attributes().await?;
                self.get_dictionary().await?;
            }
        } else {
            println!("  [i] New version detected or no previous data. Fetching from device...");
            self.get_data_handles().await?;
            self.get_all_data_attributes().await?;
            self.get_dictionary().await?;
        }

        // Persist the currently detected version only after successful initialization.
        self.version_repo.save(&version).await?;

        // Always load the equivalence cache from DB after initialization,
        // regardless of whether we fetched from device or loaded from local cache.
        // Equivalences are pre-populated via the Python loader and are independent
        // of OMNI firmware versions.
        println!("  [eq] Loading value equivalences from database...");
        self.load_equiv_cache().await?;

        println!("\n══ INITIALIZATION COMPLETE ══\n");
        Ok(version)
    }

    /// Loads the data handles, data attributes, and dictionary directly from the DB
    /// into the in-memory caches, bypassing the serial communication.
    async fn load_configuration_from_db(&mut self) -> Result<bool, UseCaseError> {
        // Load data attributes from DB
        let attrs = self.attr_repo.get_all().await?;
        self.attr_cache.clear();
        self.handles.clear();
        
        for attr in attrs {
            // Note: DB doesn't inherently store the 'order' of handles like the device does.
            // In a strict implementation, handles order must be preserved. We assume the DB 
            // `ORDER BY rowid` returns them in the insertion order.
            self.handles.push(attr.handle);
            self.attr_cache.insert(attr.handle, attr);
        }
        println!("      Loaded {} attribute(s) from DB.", self.handles.len());
        if self.handles.is_empty() {
            return Ok(false);
        }

        let dict_entries = self.dict_repo.get_all().await?;
        self.dict_cache.clear();
        for entry in dict_entries {
            self.dict_cache.insert(entry.dict_id, entry.text);
        }
        println!("      Loaded {} dictionary entries from DB.", self.dict_cache.len());
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
                .or_insert_with(std::collections::HashMap::new)
                .insert(eq.numeric_value.to_bits(), eq.display_name);
        }
        println!("      {} equivalence value(s) loaded across {} signal(s).",
            self.equiv_cache.values().map(|m| m.len()).sum::<usize>(),
            self.equiv_cache.len());
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
                let val = LittleEndian::read_u16(bytes);
                if is_signed {
                    val as i16 as i64
                } else {
                    val as i64
                }
            }
            4 => {
                let val = LittleEndian::read_u32(bytes);
                if is_signed {
                    val as i32 as i64
                } else {
                    val as i64
                }
            }
            _ => {
                // For strings or unusual sizes, return first 2 bytes as u16
                if size >= 2 {
                    LittleEndian::read_u16(bytes) as i64
                } else {
                    bytes[0] as i64
                }
            }
        }
    }
}

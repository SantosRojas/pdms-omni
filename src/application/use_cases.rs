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
    DataAttribute, DataType, DictionaryEntry, TelemetryReading, VersionInfo,
};
use crate::domain::repositories::{
    DataAttributeRepository, DictionaryRepository, TelemetryRepository, VersionRepository,
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
pub struct OmniInteractor<A, Di, T, V, Dev> {
    attr_repo: A,
    dict_repo: Di,
    telemetry_repo: T,
    version_repo: V,
    device: Dev,
    /// Ordered list of handles (as received from ANSW_GET_DATA_HANDLES).
    /// The cyclical values come in this exact order.
    handles: Vec<u16>,
}

impl<A, Di, T, V, Dev> OmniInteractor<A, Di, T, V, Dev>
where
    A: DataAttributeRepository,
    Di: DictionaryRepository,
    T: TelemetryRepository,
    V: VersionRepository,
    Dev: DeviceCommunicator,
{
    pub fn new(attr_repo: A, dict_repo: Di, telemetry_repo: T, version_repo: V, device: Dev) -> Self {
        Self {
            attr_repo,
            dict_repo,
            telemetry_repo,
            version_repo,
            device,
            handles: Vec::new(),
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
    pub fn get_versions(&mut self) -> Result<VersionInfo, UseCaseError> {
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
            String::from_utf8_lossy(&data[offset..offset + VERSION_STRING_LENGTH])
                .trim_matches('\0')
                .trim()
                .to_string()
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

        self.version_repo.save(&version)?;

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
    pub fn get_data_handles(&mut self) -> Result<Vec<u16>, UseCaseError> {
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
    pub fn get_data_attributes(&mut self, handle: u16) -> Result<DataAttribute, UseCaseError> {
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

        let attr = DataAttribute {
            handle,
            data_type,
            size,
            conversion_factor: factor,
            label_did,
            unit_did,
            internal_name,
        };

        self.attr_repo.save(&attr)?;
        Ok(attr)
    }

    /// Gets attributes for ALL handles previously discovered.
    pub fn get_all_data_attributes(&mut self) -> Result<Vec<DataAttribute>, UseCaseError> {
        let handles = self.handles.clone();
        println!("  [3] CMD_GET_DATA_ATTRS for {} handle(s)...", handles.len());

        self.attr_repo.delete_all()?;
        let mut attrs = Vec::with_capacity(handles.len());

        for (i, &handle) in handles.iter().enumerate() {
            let attr = self.get_data_attributes(handle)?;
            println!("      [{}/{}] handle=0x{:04X} name={:30} type={:?} size={} factor={}",
                i + 1, handles.len(), handle, attr.internal_name,
                attr.data_type, attr.size, attr.conversion_factor);
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
    pub fn get_dictionary(&mut self) -> Result<Vec<DictionaryEntry>, UseCaseError> {
        println!("  [4] CMD_GET_NEXT_DICT_STR (building dictionary)...");

        self.dict_repo.delete_all()?;
        let mut entries = Vec::new();
        let mut prev_id: u16 = 0;

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
            self.dict_repo.save(&entry)?;
            entries.push(entry);

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
    pub fn get_cyclical_values(&mut self) -> Result<Vec<TelemetryReading>, UseCaseError> {
        let data = self.device.request(CMD_CODE_GET_CYCLICAL_VALUES, &[])?;

        if data.len() < 2 {
            return Err(UseCaseError::Protocol("Cyclical response too short".into()));
        }

        let resp_cmd = LittleEndian::read_u16(&data[0..2]);
        if resp_cmd == CMD_CODE_NAK {
            let err_code = if data.len() >= 4 { LittleEndian::read_u16(&data[2..4]) } else { 0 };
            return Err(UseCaseError::Device(crate::domain::device::DeviceError::Nak(err_code)));
        }

        // Load attributes for all handles
        let all_attrs = self.attr_repo.get_all()?;

        // Build a map handle -> DataAttribute for quick lookup
        let attr_map: std::collections::HashMap<u16, &DataAttribute> =
            all_attrs.iter().map(|a| (a.handle, a)).collect();

        let values_data = &data[2..]; // skip cmd code
        let mut offset = 0;
        let mut readings = Vec::new();

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

            let physical_value = if attr.conversion_factor > 0 {
                raw_value as f64 / attr.conversion_factor as f64
            } else {
                raw_value as f64
            };

            // Lookup unit string from dictionary
            let unit = self.dict_repo
                .get_by_id(attr.unit_did)?
                .map(|e| e.text)
                .unwrap_or_default();

            readings.push(TelemetryReading {
                id: None,
                timestamp: String::new(), // DB sets CURRENT_TIMESTAMP
                handle,
                internal_name: attr.internal_name.clone(),
                raw_value,
                physical_value,
                unit,
            });

            offset += size;
        }

        // Persist batch
        self.telemetry_repo.save_batch(&readings)?;

        Ok(readings)
    }

    // ═══════════════════════════════════════════════════════════════
    //  FULL INITIALIZATION (convenience)
    // ═══════════════════════════════════════════════════════════════
    /// Runs the complete initialization sequence as per the protocol spec:
    /// 1. Get versions
    /// 2. Get handles
    /// 3. Get data attributes for each handle
    /// 4. Build dictionary
    pub fn initialize(&mut self) -> Result<VersionInfo, UseCaseError> {
        println!("\n══ PHASE: IDENTIFICATION ══");
        let version = self.get_versions()?;

        println!("\n══ PHASE: INITIALIZATION ══");
        self.get_data_handles()?;
        self.get_all_data_attributes()?;
        self.get_dictionary()?;

        println!("\n══ INITIALIZATION COMPLETE ══\n");
        Ok(version)
    }

    // ═══════════════════════════════════════════════════════════════
    //  PHASE 4: QUERYING (Application read logic)
    // ═══════════════════════════════════════════════════════════════
    
    /// Retrieves a specific DataAttribute by its handle from the database.
    pub fn get_attribute_by_handle(&self, handle: u16) -> Result<Option<DataAttribute>, UseCaseError> {
        let attr = self.attr_repo.get_by_handle(handle)?;
        Ok(attr)
    }

    /// Retrieves the latest saved version info from the database.
    pub fn get_latest_version_from_db(&self) -> Result<Option<VersionInfo>, UseCaseError> {
        let version = self.version_repo.get_latest()?;
        Ok(version)
    }

    /// Retrieves the most recent telemetry readings from the database.
    pub fn get_recent_readings_from_db(&self, limit: u32) -> Result<Vec<TelemetryReading>, UseCaseError> {
        let readings = self.telemetry_repo.get_recent_readings(limit)?;
        Ok(readings)
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

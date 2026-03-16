//! Domain entities for the OMNI-ODI PDMS protocol.
//! These structures represent the core business objects,
//! independent of any infrastructure detail.

/// Represents version information returned by CMD_CODE_GET_VERSIONS.
/// Contains system SW, DSS/CSS/PSS firmware/hardware versions and language info.
#[derive(Debug, Clone)]
pub struct VersionInfo {
    pub language_id: u16,
    pub system_sw: String,
    pub dss_fw: String,
    pub dss_hw: String,
    pub css_fw: String,
    pub css_hw: String,
    pub pss_fw: String,
    pub pss_hw: String,
    pub language1: String,
    pub language2: String,
    pub language3: String,
}

/// Data types as defined in the OMNI-ODI protocol (Appendix A).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u16)]
pub enum DataType {
    InputNumberUnsigned   = 1,
    InputNumberSigned     = 2,
    OutputNumberUnsigned  = 3,
    OutputNumberSigned    = 4,
    ButtonStatus          = 5,
    AlarmDid              = 6,
    WarningDid            = 7,
    StatusDid             = 8,
    EventDid              = 9,
    ServiceDid            = 10,
    VersionString         = 11,
    CalibD                = 20,
    DiaString             = 21,
    InputTimeHMin         = 22,
    OutputTimeHMin        = 23,
    DpsAlarmDid           = 24,
    Unknown               = 255,
}

impl From<u16> for DataType {
    fn from(val: u16) -> Self {
        match val {
            1  => DataType::InputNumberUnsigned,
            2  => DataType::InputNumberSigned,
            3  => DataType::OutputNumberUnsigned,
            4  => DataType::OutputNumberSigned,
            5  => DataType::ButtonStatus,
            6  => DataType::AlarmDid,
            7  => DataType::WarningDid,
            8  => DataType::StatusDid,
            9  => DataType::EventDid,
            10 => DataType::ServiceDid,
            11 => DataType::VersionString,
            20 => DataType::CalibD,
            21 => DataType::DiaString,
            22 => DataType::InputTimeHMin,
            23 => DataType::OutputTimeHMin,
            24 => DataType::DpsAlarmDid,
            _  => DataType::Unknown,
        }
    }
}

/// Attributes for a single data handle, returned by CMD_CODE_GET_DATA_ATTRS.
#[derive(Debug, Clone)]
pub struct DataAttribute {
    pub handle: u16,
    pub data_type: DataType,
    pub size: u16,
    pub conversion_factor: u16,
    pub label_did: u16,
    pub unit_did: u16,
    pub internal_name: String,
}

/// Dictionary entry: maps a dictionary ID to a localized string (UTF-8).
#[derive(Debug, Clone)]
pub struct DictionaryEntry {
    pub dict_id: u16,
    pub text: String,
}

/// A single telemetry reading extracted from the cyclical data.
#[derive(Debug, Clone)]
pub struct TelemetryReading {
    pub id: Option<i64>,
    pub timestamp: String,
    pub handle: u16,
    pub internal_name: String,
    pub raw_value: i64,
    pub physical_value: f64,
    pub unit: String,
}

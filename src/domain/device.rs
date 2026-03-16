//! OMNI-ODI protocol constants and device communication trait.
//! All command codes, address constants and error codes from
//! the Communication Description V1.20, Appendix A.

#![allow(dead_code)]

use thiserror::Error;

// ───────────────────────────────────────────────
//  Application addresses
// ───────────────────────────────────────────────
pub const DSS_APP: u8          = 1;
pub const CSS_APP: u8          = 2;
pub const PSS_APP: u8          = 3;
pub const PC_APP: u8           = 4;
pub const CSS_MON: u8          = 5;
pub const PSS_MON: u8          = 6;
pub const DSS_APP_LOADER: u8   = 7;
pub const CSS_APP_LOADER: u8   = 8;
pub const PSS_APP_LOADER: u8   = 9;
pub const PC_LOADER: u8        = 10;
pub const PC_TREND_VIEWER: u8  = 11;

// ───────────────────────────────────────────────
//  Command codes
// ───────────────────────────────────────────────
pub const CMD_CODE_GET_VERSIONS: u16        = 10;
pub const CMD_CODE_GET_HANDLES: u16         = 11;
pub const CMD_CODE_GET_DATA_ATTRS: u16      = 12;
pub const CMD_CODE_GET_NEXT_DICT_STR: u16   = 13;
pub const CMD_CODE_GET_NEXT_PICT_BLOCK: u16 = 14;
pub const CMD_CODE_GET_CYCLICAL_VALUES: u16 = 15;
pub const CMD_CODE_NAK: u16                 = 255;

// ───────────────────────────────────────────────
//  Error codes (received in NAK answers)
// ───────────────────────────────────────────────
pub const ERR_NO: u16              = 0x0000;
pub const ERR_CRC: u16            = 0x0001;
pub const ERR_TIMEOUT: u16        = 0x0002;
pub const ERR_UNKNOWN_COMMAND: u16 = 0x0003;
pub const ERR_UNKNOWN_ERROR: u16   = 0x0010;

// ───────────────────────────────────────────────
//  Button status constants
// ───────────────────────────────────────────────
pub const BUTTON_STATE_MASK: u16 = 0x0100;
pub const BUTTON_STATE_ON: u16   = 0x0100;
pub const BUTTON_STATE_OFF: u16  = 0x0000;

// ───────────────────────────────────────────────
//  Other constants
// ───────────────────────────────────────────────
pub const NO_ALARM_OR_WARNING_DID: u16   = 49999;
pub const INTERNAL_NAME_MAX_LENGTH: usize = 64;
pub const VERSION_STRING_LENGTH: usize    = 16;
pub const MAX_LANGUAGE: usize             = 3;

// ───────────────────────────────────────────────
//  Device errors
// ───────────────────────────────────────────────
#[derive(Debug, Error)]
pub enum DeviceError {
    #[error("Communication I/O error: {0}")]
    IoError(String),
    #[error("CRC mismatch in response")]
    CrcError,
    #[error("Timeout waiting for response")]
    Timeout,
    #[error("NAK received: error code 0x{0:04X}")]
    Nak(u16),
    #[error("Parse error: {0}")]
    ParseError(String),
}

/// Trait that abstracts the communication with the OMNI device.
/// Infrastructure layer implements this (serial, TCP, mock, etc.).
/// The domain and application layers ONLY know this trait.
pub trait DeviceCommunicator {
    /// Sends a command frame (with framing, CRC, etc.) to the device.
    fn send_command(&mut self, cmd: u16, data: &[u8]) -> Result<(), DeviceError>;

    /// Reads a complete response from the device.
    /// Returns the DATA PART only (without frame header and CRC).
    fn read_response(&mut self) -> Result<Vec<u8>, DeviceError>;

    /// Convenience: send command + read response.
    fn request(&mut self, cmd: u16, data: &[u8]) -> Result<Vec<u8>, DeviceError> {
        self.send_command(cmd, data)?;
        self.read_response()
    }
}

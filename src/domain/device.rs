//! OMNI-ODI protocol constants and device communication trait.

use thiserror::Error;

/// Command codes
pub const CMD_CODE_GET_VERSIONS: u16 = 10;
/// Command codes
pub const CMD_CODE_GET_HANDLES: u16 = 11;
/// Command codes
pub const CMD_CODE_GET_DATA_ATTRS: u16 = 12;
/// Command codes
pub const CMD_CODE_GET_NEXT_DICT_STR: u16 = 13;
/// Command codes
pub const CMD_CODE_GET_CYCLICAL_VALUES: u16 = 15;
/// Command codes
pub const CMD_CODE_NAK: u16 = 255;

/// Other constants
pub const VERSION_STRING_LENGTH: usize = 16;

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

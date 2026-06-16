use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::{Mutex, mpsc};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReaderCommand {
    Start { id: u64, new_therapy: bool },
    Stop,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerialReaderStatus {
    pub status: String, // "Stopped", "Initializing", "Running", "FailedLimit"
    pub consecutive_failures: u32,
    pub max_failures: u32,
    pub data_warnings: u32,
    pub close_therapy_on_stop: bool,
}

pub struct SerialReaderManager {
    cmd_tx: mpsc::Sender<ReaderCommand>,
    state: Arc<Mutex<SerialReaderStatus>>,
}

impl SerialReaderManager {
    pub fn new(
        max_failures: u32,
        start_active: bool,
    ) -> (
        Self,
        mpsc::Receiver<ReaderCommand>,
        Arc<Mutex<SerialReaderStatus>>,
    ) {
        let initial_status = if start_active {
            "Initializing"
        } else {
            "Stopped"
        };
        let state = Arc::new(Mutex::new(SerialReaderStatus {
            status: initial_status.to_string(),
            consecutive_failures: 0,
            max_failures,
            data_warnings: 0,
            close_therapy_on_stop: true,
        }));

        let (cmd_tx, cmd_rx) = mpsc::channel(16);
        // Pre-seed with the initial command so the reader thread always has a command to process
        let initial_cmd = if start_active {
            ReaderCommand::Start {
                id: chrono::Utc::now().timestamp_millis() as u64,
                new_therapy: false,
            }
        } else {
            ReaderCommand::Stop
        };
        let _ = cmd_tx.try_send(initial_cmd);

        (
            Self {
                cmd_tx,
                state: state.clone(),
            },
            cmd_rx,
            state,
        )
    }

    pub async fn get_status(&self) -> SerialReaderStatus {
        self.state.lock().await.clone()
    }

    pub async fn start(&self, new_therapy: bool) {
        let mut s = self.state.lock().await;
        s.status = "Initializing".to_string();
        s.consecutive_failures = 0;
        s.data_warnings = 0;
        let id = chrono::Utc::now().timestamp_millis() as u64;
        let _ = self
            .cmd_tx
            .send(ReaderCommand::Start { id, new_therapy })
            .await;
    }

    pub async fn stop(&self, close_therapy: bool) {
        let mut s = self.state.lock().await;
        s.status = "Stopped".to_string();
        s.close_therapy_on_stop = close_therapy;
        let _ = self.cmd_tx.send(ReaderCommand::Stop).await;
    }

    /// Mark session as actively running (after successful init).
    pub async fn set_running(&self) {
        let mut s = self.state.lock().await;
        s.status = "Running".to_string();
    }

    /// Record a successful cycle read; resets consecutive failure counter.
    pub async fn record_success(&self) {
        let mut s = self.state.lock().await;
        s.consecutive_failures = 0;
        if s.status == "Initializing" {
            s.status = "Running".to_string();
        }
    }

    /// Record a data integrity warning (CRC, parse error, NAK, etc.).
    /// These do NOT count toward the failure limit and will NOT stop the reader.
    pub async fn record_warning(&self) {
        let mut s = self.state.lock().await;
        s.data_warnings += 1;
        // Keep status as-is; never transition to FailedLimit from warnings.
    }

    /// Immediately transition to FailedLimit (e.g. device init exhausted its own retries).
    /// Unlike `record_failure`, this doesn't depend on `max_failures`.
    pub async fn set_failed_limit(&self) {
        let mut s = self.state.lock().await;
        s.status = "FailedLimit".to_string();
        s.close_therapy_on_stop = true;
        let _ = self.cmd_tx.send(ReaderCommand::Stop).await;
    }

    /// Record one connection failure (I/O error, timeout).
    /// Transitions to FailedLimit when threshold is reached.
    pub async fn record_failure(&self) -> bool {
        let mut s = self.state.lock().await;
        s.consecutive_failures += 1;
        if s.consecutive_failures >= s.max_failures {
            s.status = "FailedLimit".to_string();
            s.close_therapy_on_stop = true;
            let _ = self.cmd_tx.send(ReaderCommand::Stop).await;
            return true;
        }
        false
    }
}

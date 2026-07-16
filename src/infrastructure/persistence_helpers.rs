use crate::domain::entities::TelemetryReading;
use crate::domain::entities::TelemetryValue;

#[derive(Debug, Clone)]
pub struct GenericRow {
    pub values: Vec<Option<String>>,
}

impl GenericRow {
    pub fn get_string(&self, idx: usize) -> String {
        self.values
            .get(idx)
            .and_then(|v| v.clone())
            .unwrap_or_default()
    }

    pub fn get_i64(&self, idx: usize) -> i64 {
        self.values
            .get(idx)
            .and_then(|v| v.as_ref())
            .and_then(|s| s.parse().ok())
            .unwrap_or(0)
    }

    pub fn get_f64(&self, idx: usize) -> f64 {
        self.values
            .get(idx)
            .and_then(|v| v.as_ref())
            .and_then(|s| s.parse().ok())
            .unwrap_or(0.0)
    }

    pub fn get_bool(&self, idx: usize) -> bool {
        self.values
            .get(idx)
            .and_then(|v| v.as_ref())
            .map(|s| s == "1" || s.eq_ignore_ascii_case("true"))
            .unwrap_or(false)
    }

    pub fn get_optional_string(&self, idx: usize) -> Option<String> {
        self.values.get(idx).and_then(|v| v.clone())
    }

    pub fn get_optional_i64(&self, idx: usize) -> Option<i64> {
        self.values
            .get(idx)
            .and_then(|v| v.as_ref())
            .and_then(|s| s.parse().ok())
    }

    pub fn get_optional_naivedatetime(&self, idx: usize) -> Option<chrono::NaiveDateTime> {
        self.values
            .get(idx)
            .and_then(|v| v.as_ref())
            .and_then(|s| {
                chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S")
                    .or_else(|_| chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S"))
                    .ok()
            })
    }
}

pub const SQLITE_NUMERIC_EQ_EXPR: &str = "CAST(t.physical_value AS REAL)";
pub const MSSQL_NUMERIC_EQ_EXPR: &str = "TRY_CONVERT(FLOAT, t.physical_value)";
pub const POSTGRES_NUMERIC_EQ_EXPR: &str = r#"CASE WHEN t.physical_value ~ '^-?[0-9]+(\.[0-9]+)?$' THEN t.physical_value::double precision END"#;

pub fn telemetry_value_to_storage(value: &TelemetryValue) -> String {
    match value {
        TelemetryValue::Number(n) => n.to_string(),
        TelemetryValue::String(s) => s.clone(),
    }
}

pub fn telemetry_value_from_storage(raw: String) -> TelemetryValue {
    if let Ok(n) = raw.parse::<f64>() {
        TelemetryValue::Number(n)
    } else {
        TelemetryValue::String(raw)
    }
}

fn flag_from_bool(value: bool) -> Option<String> {
    Some(if value { "1" } else { "0" }.to_string())
}

#[allow(clippy::too_many_arguments)]
pub fn build_user_row(
    id: i64,
    username: String,
    password: String,
    full_name: String,
    email: String,
    role: String,
    active: bool,
    created_at: String,
) -> GenericRow {
    GenericRow {
        values: vec![
            Some(id.to_string()),
            Some(username),
            Some(password),
            Some(full_name),
            Some(email),
            Some(role),
            flag_from_bool(active),
            Some(created_at),
        ],
    }
}

pub fn build_user_list_row(
    id: i64,
    username: String,
    full_name: String,
    email: String,
    role: String,
    active: bool,
    created_at: String,
) -> GenericRow {
    GenericRow {
        values: vec![
            Some(id.to_string()),
            Some(username),
            Some(full_name),
            Some(email),
            Some(role),
            flag_from_bool(active),
            Some(created_at),
        ],
    }
}

pub fn build_equivalence_row(
    signal_id: i64,
    internal_name: String,
    numeric_value: f64,
    display_name: String,
) -> GenericRow {
    GenericRow {
        values: vec![
            Some(signal_id.to_string()),
            Some(internal_name),
            Some(numeric_value.to_string()),
            Some(display_name),
        ],
    }
}

pub fn build_patient_row(id: i64, patient_id_str: String, created_at: String) -> GenericRow {
    GenericRow {
        values: vec![Some(id.to_string()), Some(patient_id_str), Some(created_at)],
    }
}

pub fn build_signal_row(
    id: i64,
    internal_name: String,
    display_name: Option<String>,
    unit: Option<String>,
) -> GenericRow {
    GenericRow {
        values: vec![
            Some(id.to_string()),
            Some(internal_name),
            display_name,
            unit,
        ],
    }
}

pub fn build_history_row(
    id: i64,
    timestamp: String,
    internal_name: String,
    physical_value: String,
    display_name: Option<String>,
    unit: String,
) -> GenericRow {
    GenericRow {
        values: vec![
            Some(id.to_string()),
            Some(timestamp),
            Some(internal_name),
            Some(physical_value),
            display_name,
            Some(unit),
        ],
    }
}

pub fn build_therapy_comment_row(
    id: i64,
    therapy_id: i64,
    author_name: String,
    comment: String,
    created_at: String,
    deleted_at: Option<String>,
    deletion_reason: Option<String>,
) -> GenericRow {
    GenericRow {
        values: vec![
            Some(id.to_string()),
            Some(therapy_id.to_string()),
            Some(author_name),
            Some(comment),
            Some(created_at),
            deleted_at,
            deletion_reason,
        ],
    }
}

#[allow(clippy::too_many_arguments)]
pub fn build_therapy_row(
    id: i64,
    started_at: String,
    ended_at: Option<String>,
    status: String,
    patient_id: i64,
    patient_id_str: String,
    machine_id: i64,
    serial_number: String,
    software_version: String,
    serial_session_id: Option<i64>,
) -> GenericRow {
    GenericRow {
        values: vec![
            Some(id.to_string()),
            Some(started_at),
            ended_at,
            Some(status),
            Some(patient_id.to_string()),
            Some(patient_id_str),
            Some(machine_id.to_string()),
            Some(serial_number),
            Some(software_version),
            serial_session_id.map(|v| v.to_string()),
        ],
    }
}

pub fn build_export_row(
    timestamp: String,
    internal_name: String,
    physical_value: String,
    display_name: Option<String>,
    unit: String,
) -> GenericRow {
    GenericRow {
        values: vec![
            Some(timestamp),
            Some(internal_name),
            Some(physical_value),
            display_name,
            Some(unit),
        ],
    }
}

#[allow(clippy::too_many_arguments)]
pub fn build_telemetry_reading(
    id: Option<i64>,
    timestamp: String,
    therapy_id: Option<i64>,
    signal_id: i64,
    internal_name: String,
    raw_value: i64,
    physical_value: String,
    unit: String,
    display_value: Option<String>,
    serial_session_id: Option<i64>,
) -> TelemetryReading {
    TelemetryReading {
        id,
        timestamp,
        therapy_id,
        serial_session_id,
        signal_id,
        internal_name,
        raw_value,
        physical_value: telemetry_value_from_storage(physical_value),
        unit,
        display_value,
        phase: None,
    }
}

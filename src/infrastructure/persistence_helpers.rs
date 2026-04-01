use crate::domain::entities::TelemetryValue;

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
//! Database pool abstraction: supports SQLite (via sqlx) and MSSQL (via tiberius + bb8).
//! Provides all the direct query methods needed by the HTTP API layer.
//! MSSQL queries use tiberius::Query with .bind() for mixed parameter types.

use sqlx::{SqlitePool, Row as SqlxRow};
use bb8::Pool;
use bb8_tiberius::ConnectionManager;
use tiberius::{Row as TibRow, Query};

/// A backend-agnostic database connection pool.
#[derive(Clone)]
pub enum DbPool {
    Sqlite(SqlitePool),
    Mssql(Pool<ConnectionManager>),
}

// ═══════════════════════════════════════════════════════════════════
//  Row abstraction for query results
// ═══════════════════════════════════════════════════════════════════

#[derive(Debug, Clone)]
pub struct GenericRow {
    pub values: Vec<Option<String>>,
}

impl GenericRow {
    pub fn get_string(&self, idx: usize) -> String {
        self.values.get(idx).and_then(|v| v.clone()).unwrap_or_default()
    }
    pub fn get_i64(&self, idx: usize) -> i64 {
        self.values.get(idx).and_then(|v| v.as_ref()).and_then(|s| s.parse().ok()).unwrap_or(0)
    }
    pub fn get_f64(&self, idx: usize) -> f64 {
        self.values.get(idx).and_then(|v| v.as_ref()).and_then(|s| s.parse().ok()).unwrap_or(0.0)
    }
    pub fn get_bool(&self, idx: usize) -> bool {
        self.values.get(idx).and_then(|v| v.as_ref()).map(|s| s == "1" || s.eq_ignore_ascii_case("true")).unwrap_or(false)
    }
    pub fn get_optional_string(&self, idx: usize) -> Option<String> {
        self.values.get(idx).and_then(|v| v.clone())
    }
}

// ═══════════════════════════════════════════════════════════════════
//  DbPool query methods used by http_api.rs
// ═══════════════════════════════════════════════════════════════════

impl DbPool {
    // ─── USER queries ──────────────────────────────────────────

    pub async fn find_user_by_username(&self, username: &str) -> Result<Option<GenericRow>, String> {
        match self {
            DbPool::Sqlite(pool) => {
                let row = sqlx::query("SELECT id, username, password, full_name, email, role, active, created_at FROM users WHERE username = ?1")
                    .bind(username).fetch_optional(pool).await.map_err(|e| e.to_string())?;
                Ok(row.map(|r| GenericRow {
                    values: vec![
                        Some(r.get::<i64, _>(0).to_string()), Some(r.get::<String, _>(1)),
                        Some(r.get::<String, _>(2)), Some(r.get::<String, _>(3)),
                        Some(r.get::<String, _>(4)), Some(r.get::<String, _>(5)),
                        Some(if r.get::<bool, _>(6) { "1".into() } else { "0".into() }),
                        Some(r.get::<String, _>(7)),
                    ],
                }))
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let mut q = Query::new("SELECT id, username, password, full_name, email, role, active, CONVERT(NVARCHAR(30), created_at, 120) AS created_at FROM users WHERE username = @P1");
                q.bind(username);
                let stream = q.query(&mut *conn).await.map_err(|e| e.to_string())?;
                let rows: Vec<TibRow> = stream.into_first_result().await.map_err(|e| e.to_string())?;
                Ok(rows.into_iter().next().map(|r: TibRow| GenericRow {
                    values: vec![
                        r.get::<i32, _>(0).map(|v| v.to_string()), r.get::<&str, _>(1).map(|v| v.to_string()),
                        r.get::<&str, _>(2).map(|v| v.to_string()), r.get::<&str, _>(3).map(|v| v.to_string()),
                        r.get::<&str, _>(4).map(|v| v.to_string()), r.get::<&str, _>(5).map(|v| v.to_string()),
                        r.get::<bool, _>(6).map(|v| if v { "1".into() } else { "0".into() }),
                        r.get::<&str, _>(7).map(|v| v.to_string()),
                    ],
                }))
            }
        }
    }

    pub async fn list_users(&self) -> Result<Vec<GenericRow>, String> {
        match self {
            DbPool::Sqlite(pool) => {
                let rows = sqlx::query("SELECT id, username, full_name, email, role, active, created_at FROM users ORDER BY id")
                    .fetch_all(pool).await.map_err(|e| e.to_string())?;
                Ok(rows.into_iter().map(|r| GenericRow {
                    values: vec![
                        Some(r.get::<i64, _>(0).to_string()), Some(r.get::<String, _>(1)),
                        Some(r.get::<String, _>(2)), Some(r.get::<String, _>(3)),
                        Some(r.get::<String, _>(4)),
                        Some(if r.get::<bool, _>(5) { "1".into() } else { "0".into() }),
                        Some(r.get::<String, _>(6)),
                    ],
                }).collect())
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let mut q = Query::new("SELECT id, username, full_name, email, role, active, CONVERT(NVARCHAR(30), created_at, 120) FROM users ORDER BY id");
                let stream = q.query(&mut *conn).await.map_err(|e| e.to_string())?;
                let rows: Vec<TibRow> = stream.into_first_result().await.map_err(|e| e.to_string())?;
                Ok(rows.into_iter().map(|r: TibRow| GenericRow {
                    values: vec![
                        r.get::<i32, _>(0).map(|v| v.to_string()), r.get::<&str, _>(1).map(|v| v.to_string()),
                        r.get::<&str, _>(2).map(|v| v.to_string()), r.get::<&str, _>(3).map(|v| v.to_string()),
                        r.get::<&str, _>(4).map(|v| v.to_string()),
                        r.get::<bool, _>(5).map(|v| if v { "1".into() } else { "0".into() }),
                        r.get::<&str, _>(6).map(|v| v.to_string()),
                    ],
                }).collect())
            }
        }
    }

    pub async fn insert_user(&self, username: &str, password: &str, full_name: &str, email: &str, role: &str) -> Result<(), String> {
        match self {
            DbPool::Sqlite(pool) => {
                sqlx::query("INSERT INTO users (username, password, full_name, email, role) VALUES (?1, ?2, ?3, ?4, ?5)")
                    .bind(username).bind(password).bind(full_name).bind(email).bind(role)
                    .execute(pool).await.map_err(|e| e.to_string())?;
                Ok(())
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let mut q = Query::new("INSERT INTO users (username, password, full_name, email, role) VALUES (@P1, @P2, @P3, @P4, @P5)");
                q.bind(username); q.bind(password); q.bind(full_name); q.bind(email); q.bind(role);
                q.execute(&mut *conn).await.map_err(|e| e.to_string())?;
                Ok(())
            }
        }
    }

    pub async fn update_user_field(&self, user_id: i64, field: &str, value: &str) -> Result<(), String> {
        let allowed = ["password", "full_name", "email", "role"];
        if !allowed.contains(&field) { return Err(format!("Field '{}' not allowed", field)); }
        match self {
            DbPool::Sqlite(pool) => {
                let sql = format!("UPDATE users SET {} = ?1 WHERE id = ?2", field);
                sqlx::query(&sql).bind(value).bind(user_id).execute(pool).await.map_err(|e| e.to_string())?;
                Ok(())
            }
            DbPool::Mssql(pool) => {
                let sql = format!("UPDATE users SET {} = @P1 WHERE id = @P2", field);
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let mut q = Query::new(sql);
                q.bind(value); q.bind(user_id as i32);
                q.execute(&mut *conn).await.map_err(|e| e.to_string())?;
                Ok(())
            }
        }
    }

    pub async fn update_user_active(&self, user_id: i64, active: bool) -> Result<(), String> {
        match self {
            DbPool::Sqlite(pool) => {
                sqlx::query("UPDATE users SET active = ?1 WHERE id = ?2").bind(active).bind(user_id)
                    .execute(pool).await.map_err(|e| e.to_string())?;
                Ok(())
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let mut q = Query::new("UPDATE users SET active = @P1 WHERE id = @P2");
                q.bind(active); q.bind(user_id as i32);
                q.execute(&mut *conn).await.map_err(|e| e.to_string())?;
                Ok(())
            }
        }
    }

    pub async fn delete_user(&self, user_id: i64) -> Result<(), String> {
        match self {
            DbPool::Sqlite(pool) => {
                sqlx::query("DELETE FROM users WHERE id = ?1").bind(user_id).execute(pool).await.map_err(|e| e.to_string())?;
                Ok(())
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let mut q = Query::new("DELETE FROM users WHERE id = @P1");
                q.bind(user_id as i32);
                q.execute(&mut *conn).await.map_err(|e| e.to_string())?;
                Ok(())
            }
        }
    }

    // ─── EQUIVALENCES ─────────────────────────────────────────

    pub async fn list_equivalences(&self) -> Result<Vec<GenericRow>, String> {
        match self {
            DbPool::Sqlite(pool) => {
                let rows = sqlx::query("SELECT ae.signal_id, s.internal_name, ae.numeric_value, ae.display_name FROM attribute_equivalences ae JOIN signals s ON ae.signal_id = s.id ORDER BY s.internal_name, ae.numeric_value")
                    .fetch_all(pool).await.map_err(|e| e.to_string())?;
                Ok(rows.into_iter().map(|r| GenericRow {
                    values: vec![Some(r.get::<i64, _>(0).to_string()), Some(r.get::<String, _>(1)), Some(r.get::<f64, _>(2).to_string()), Some(r.get::<String, _>(3))],
                }).collect())
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let mut q = Query::new("SELECT ae.signal_id, s.internal_name, ae.numeric_value, ae.display_name FROM attribute_equivalences ae JOIN signals s ON ae.signal_id = s.id ORDER BY s.internal_name, ae.numeric_value");
                let stream = q.query(&mut *conn).await.map_err(|e| e.to_string())?;
                let rows: Vec<TibRow> = stream.into_first_result().await.map_err(|e| e.to_string())?;
                Ok(rows.into_iter().map(|r: TibRow| GenericRow {
                    values: vec![r.get::<i32, _>(0).map(|v| v.to_string()), r.get::<&str, _>(1).map(|v| v.to_string()), r.get::<f64, _>(2).map(|v| v.to_string()), r.get::<&str, _>(3).map(|v| v.to_string())],
                }).collect())
            }
        }
    }

    pub async fn get_or_create_signal(&self, internal_name: &str) -> Result<i64, String> {
        match self {
            DbPool::Sqlite(pool) => {
                sqlx::query("INSERT OR IGNORE INTO signals (internal_name) VALUES (?1)").bind(internal_name).execute(pool).await.map_err(|e| e.to_string())?;
                let row = sqlx::query("SELECT id FROM signals WHERE internal_name = ?1").bind(internal_name).fetch_one(pool).await.map_err(|e| e.to_string())?;
                Ok(row.get::<i64, _>(0))
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let mut q1 = Query::new("IF NOT EXISTS (SELECT 1 FROM signals WHERE internal_name = @P1) INSERT INTO signals (internal_name) VALUES (@P1)");
                q1.bind(internal_name);
                q1.execute(&mut *conn).await.map_err(|e| e.to_string())?;
                let mut q2 = Query::new("SELECT id FROM signals WHERE internal_name = @P1");
                q2.bind(internal_name);
                let stream = q2.query(&mut *conn).await.map_err(|e| e.to_string())?;
                let rows: Vec<TibRow> = stream.into_first_result().await.map_err(|e| e.to_string())?;
                let id = rows.first().and_then(|r: &TibRow| r.get::<i32, _>(0)).ok_or("Signal not found")?;
                Ok(id as i64)
            }
        }
    }

    pub async fn upsert_equivalence(&self, signal_id: i64, numeric_value: f64, display_name: &str) -> Result<(), String> {
        match self {
            DbPool::Sqlite(pool) => {
                sqlx::query("INSERT OR REPLACE INTO attribute_equivalences (signal_id, numeric_value, display_name) VALUES (?1, ?2, ?3)")
                    .bind(signal_id).bind(numeric_value).bind(display_name).execute(pool).await.map_err(|e| e.to_string())?;
                Ok(())
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let mut q = Query::new("MERGE attribute_equivalences AS tgt USING (SELECT @P1 AS signal_id, @P2 AS numeric_value) AS src ON tgt.signal_id = src.signal_id AND tgt.numeric_value = src.numeric_value WHEN MATCHED THEN UPDATE SET display_name = @P3 WHEN NOT MATCHED THEN INSERT (signal_id, numeric_value, display_name) VALUES (@P1, @P2, @P3);");
                q.bind(signal_id as i32); q.bind(numeric_value); q.bind(display_name);
                q.execute(&mut *conn).await.map_err(|e| e.to_string())?;
                Ok(())
            }
        }
    }

    pub async fn delete_equivalence(&self, signal_id: i64, numeric_value: f64) -> Result<(), String> {
        match self {
            DbPool::Sqlite(pool) => {
                sqlx::query("DELETE FROM attribute_equivalences WHERE signal_id = ?1 AND numeric_value = ?2")
                    .bind(signal_id).bind(numeric_value).execute(pool).await.map_err(|e| e.to_string())?;
                Ok(())
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let mut q = Query::new("DELETE FROM attribute_equivalences WHERE signal_id = @P1 AND numeric_value = @P2");
                q.bind(signal_id as i32); q.bind(numeric_value);
                q.execute(&mut *conn).await.map_err(|e| e.to_string())?;
                Ok(())
            }
        }
    }

    // ─── PATIENT / TELEMETRY ──────────────────────────────────

    pub async fn list_patients(&self) -> Result<Vec<GenericRow>, String> {
        match self {
            DbPool::Sqlite(pool) => {
                let rows = sqlx::query("SELECT id, patient_id_str, created_at FROM patients ORDER BY created_at DESC")
                    .fetch_all(pool).await.map_err(|e| e.to_string())?;
                Ok(rows.into_iter().map(|r| GenericRow {
                    values: vec![Some(r.get::<i64, _>(0).to_string()), Some(r.get::<String, _>(1)), Some(r.get::<String, _>(2))],
                }).collect())
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let mut q = Query::new("SELECT id, patient_id_str, CONVERT(NVARCHAR(30), created_at, 120) FROM patients ORDER BY created_at DESC");
                let stream = q.query(&mut *conn).await.map_err(|e| e.to_string())?;
                let rows: Vec<TibRow> = stream.into_first_result().await.map_err(|e| e.to_string())?;
                Ok(rows.into_iter().map(|r: TibRow| GenericRow {
                    values: vec![r.get::<i32, _>(0).map(|v| v.to_string()), r.get::<&str, _>(1).map(|v| v.to_string()), r.get::<&str, _>(2).map(|v| v.to_string())],
                }).collect())
            }
        }
    }

    pub async fn patient_history(&self, patient_id_str: &str, limit: u32) -> Result<Vec<GenericRow>, String> {
        match self {
            DbPool::Sqlite(pool) => {
                let rows = sqlx::query(
                    "SELECT t.id, t.timestamp, s.internal_name, CAST(t.physical_value AS TEXT), e.display_name, t.unit FROM telemetry t JOIN patients p ON t.patient_id = p.id JOIN signals s ON t.signal_id = s.id LEFT JOIN attribute_equivalences e ON s.id = e.signal_id AND t.physical_value = e.numeric_value WHERE p.patient_id_str = ?1 ORDER BY t.timestamp DESC LIMIT ?2"
                ).bind(patient_id_str).bind(limit).fetch_all(pool).await.map_err(|e| e.to_string())?;
                Ok(rows.into_iter().map(|r| GenericRow {
                    values: vec![Some(r.get::<i64, _>(0).to_string()), Some(r.get::<String, _>(1)), Some(r.get::<String, _>(2)), Some(r.get::<String, _>(3)), r.get::<Option<String>, _>(4), Some(r.get::<String, _>(5))],
                }).collect())
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let mut q = Query::new(
                    "SELECT TOP(@P1) t.id, CONVERT(NVARCHAR(30), t.timestamp, 120), s.internal_name, CAST(t.physical_value AS NVARCHAR(MAX)), e.display_name, t.unit FROM telemetry t JOIN patients p ON t.patient_id = p.id JOIN signals s ON t.signal_id = s.id LEFT JOIN attribute_equivalences e ON s.id = e.signal_id AND t.physical_value = e.numeric_value WHERE p.patient_id_str = @P2 ORDER BY t.timestamp DESC"
                );
                q.bind(limit as i32); q.bind(patient_id_str);
                let stream = q.query(&mut *conn).await.map_err(|e| e.to_string())?;
                let rows: Vec<TibRow> = stream.into_first_result().await.map_err(|e| e.to_string())?;
                Ok(rows.into_iter().map(|r: TibRow| GenericRow {
                    values: vec![r.get::<i32, _>(0).map(|v| v.to_string()), r.get::<&str, _>(1).map(|v| v.to_string()), r.get::<&str, _>(2).map(|v| v.to_string()), r.get::<&str, _>(3).map(|v| v.to_string()), r.get::<&str, _>(4).map(|v| v.to_string()), r.get::<&str, _>(5).map(|v| v.to_string())],
                }).collect())
            }
        }
    }

    pub async fn export_history(&self, patient_id_str: &str, limit: u32) -> Result<Vec<GenericRow>, String> {
        match self {
            DbPool::Sqlite(pool) => {
                let rows = sqlx::query(
                    "SELECT t.timestamp, s.internal_name, CAST(t.physical_value AS TEXT), e.display_name, t.unit FROM telemetry t JOIN patients p ON t.patient_id = p.id JOIN signals s ON t.signal_id = s.id LEFT JOIN attribute_equivalences e ON s.id = e.signal_id AND t.physical_value = e.numeric_value WHERE p.patient_id_str = ?1 ORDER BY t.timestamp ASC LIMIT ?2"
                ).bind(patient_id_str).bind(limit).fetch_all(pool).await.map_err(|e| e.to_string())?;
                Ok(rows.into_iter().map(|r| GenericRow {
                    values: vec![Some(r.get::<String, _>(0)), Some(r.get::<String, _>(1)), Some(r.get::<String, _>(2)), r.get::<Option<String>, _>(3), Some(r.get::<String, _>(4))],
                }).collect())
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let mut q = Query::new(
                    "SELECT TOP(@P1) CONVERT(NVARCHAR(30), t.timestamp, 120), s.internal_name, CAST(t.physical_value AS NVARCHAR(MAX)), e.display_name, t.unit FROM telemetry t JOIN patients p ON t.patient_id = p.id JOIN signals s ON t.signal_id = s.id LEFT JOIN attribute_equivalences e ON s.id = e.signal_id AND t.physical_value = e.numeric_value WHERE p.patient_id_str = @P2 ORDER BY t.timestamp ASC"
                );
                q.bind(limit as i32); q.bind(patient_id_str);
                let stream = q.query(&mut *conn).await.map_err(|e| e.to_string())?;
                let rows: Vec<TibRow> = stream.into_first_result().await.map_err(|e| e.to_string())?;
                Ok(rows.into_iter().map(|r: TibRow| GenericRow {
                    values: vec![r.get::<&str, _>(0).map(|v| v.to_string()), r.get::<&str, _>(1).map(|v| v.to_string()), r.get::<&str, _>(2).map(|v| v.to_string()), r.get::<&str, _>(3).map(|v| v.to_string()), r.get::<&str, _>(4).map(|v| v.to_string())],
                }).collect())
            }
        }
    }
}

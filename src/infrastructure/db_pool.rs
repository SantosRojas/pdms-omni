//! Database pool abstraction: supports SQLite (via sqlx) and MSSQL (via tiberius + bb8).
//! Provides all the direct query methods needed by the HTTP API layer.
//! MSSQL queries use tiberius::Query with .bind() for mixed parameter types.

use bb8::Pool;
use bb8_tiberius::ConnectionManager;
use sqlx::{PgPool, Row as SqlxRow, SqlitePool};
use tiberius::{Query, Row as TibRow};

use crate::infrastructure::persistence_helpers::{
    GenericRow, MSSQL_NUMERIC_EQ_EXPR, POSTGRES_NUMERIC_EQ_EXPR, SQLITE_NUMERIC_EQ_EXPR,
    build_equivalence_row, build_export_row, build_history_row, build_patient_row,
    build_therapy_comment_row, build_therapy_row, build_user_list_row, build_user_row,
};

/// A backend-agnostic database connection pool.
#[derive(Clone)]
pub enum DbPool {
    Sqlite(SqlitePool),
    Postgres(PgPool),
    Mssql(Pool<ConnectionManager>),
}

// ═══════════════════════════════════════════════════════════════════
//  DbPool query methods used by http_api.rs
// ═══════════════════════════════════════════════════════════════════

impl DbPool {
    // ─── USER queries ──────────────────────────────────────────

    pub async fn find_user_by_username(
        &self,
        username: &str,
    ) -> Result<Option<GenericRow>, String> {
        match self {
            DbPool::Sqlite(pool) => {
                let row = sqlx::query("SELECT id, username, password, full_name, email, role, active, created_at FROM users WHERE username = ?1")
                    .bind(username).fetch_optional(pool).await.map_err(|e| e.to_string())?;
                Ok(row.map(|r| {
                    build_user_row(
                        r.get::<i64, _>(0),
                        r.get::<String, _>(1),
                        r.get::<String, _>(2),
                        r.get::<String, _>(3),
                        r.get::<String, _>(4),
                        r.get::<String, _>(5),
                        r.get::<bool, _>(6),
                        r.get::<String, _>(7),
                    )
                }))
            }
            DbPool::Postgres(pool) => {
                let row = sqlx::query("SELECT id, username, password, full_name, email, role, active, TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') FROM users WHERE username = $1")
                    .bind(username).fetch_optional(pool).await.map_err(|e| e.to_string())?;
                Ok(row.map(|r| {
                    build_user_row(
                        r.get::<i64, _>(0),
                        r.get::<String, _>(1),
                        r.get::<String, _>(2),
                        r.get::<String, _>(3),
                        r.get::<String, _>(4),
                        r.get::<String, _>(5),
                        r.get::<bool, _>(6),
                        r.get::<String, _>(7),
                    )
                }))
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let mut q = Query::new(
                    "SELECT id, username, password, full_name, email, role, active, CONVERT(NVARCHAR(30), created_at, 120) AS created_at FROM users WHERE username = @P1",
                );
                q.bind(username);
                let stream = q.query(&mut *conn).await.map_err(|e| e.to_string())?;
                let rows: Vec<TibRow> = stream
                    .into_first_result()
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(rows.into_iter().next().map(|r: TibRow| {
                    build_user_row(
                        r.get::<i32, _>(0).map(|v| v as i64).unwrap_or(0),
                        r.get::<&str, _>(1).unwrap_or("").to_string(),
                        r.get::<&str, _>(2).unwrap_or("").to_string(),
                        r.get::<&str, _>(3).unwrap_or("").to_string(),
                        r.get::<&str, _>(4).unwrap_or("").to_string(),
                        r.get::<&str, _>(5).unwrap_or("").to_string(),
                        r.get::<bool, _>(6).unwrap_or(false),
                        r.get::<&str, _>(7).unwrap_or("").to_string(),
                    )
                }))
            }
        }
    }

    pub async fn list_users(&self) -> Result<Vec<GenericRow>, String> {
        match self {
            DbPool::Sqlite(pool) => {
                let rows = sqlx::query("SELECT id, username, full_name, email, role, active, created_at FROM users ORDER BY id")
                    .fetch_all(pool).await.map_err(|e| e.to_string())?;
                Ok(rows
                    .into_iter()
                    .map(|r| {
                        build_user_list_row(
                            r.get::<i64, _>(0),
                            r.get::<String, _>(1),
                            r.get::<String, _>(2),
                            r.get::<String, _>(3),
                            r.get::<String, _>(4),
                            r.get::<bool, _>(5),
                            r.get::<String, _>(6),
                        )
                    })
                    .collect())
            }
            DbPool::Postgres(pool) => {
                let rows = sqlx::query("SELECT id, username, full_name, email, role, active, TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') FROM users ORDER BY id")
                    .fetch_all(pool).await.map_err(|e| e.to_string())?;
                Ok(rows
                    .into_iter()
                    .map(|r| {
                        build_user_list_row(
                            r.get::<i64, _>(0),
                            r.get::<String, _>(1),
                            r.get::<String, _>(2),
                            r.get::<String, _>(3),
                            r.get::<String, _>(4),
                            r.get::<bool, _>(5),
                            r.get::<String, _>(6),
                        )
                    })
                    .collect())
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let q = Query::new(
                    "SELECT id, username, full_name, email, role, active, CONVERT(NVARCHAR(30), created_at, 120) FROM users ORDER BY id",
                );
                let stream = q.query(&mut *conn).await.map_err(|e| e.to_string())?;
                let rows: Vec<TibRow> = stream
                    .into_first_result()
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(rows
                    .into_iter()
                    .map(|r: TibRow| {
                        build_user_list_row(
                            r.get::<i32, _>(0).map(|v| v as i64).unwrap_or(0),
                            r.get::<&str, _>(1).unwrap_or("").to_string(),
                            r.get::<&str, _>(2).unwrap_or("").to_string(),
                            r.get::<&str, _>(3).unwrap_or("").to_string(),
                            r.get::<&str, _>(4).unwrap_or("").to_string(),
                            r.get::<bool, _>(5).unwrap_or(false),
                            r.get::<&str, _>(6).unwrap_or("").to_string(),
                        )
                    })
                    .collect())
            }
        }
    }

    pub async fn insert_user(
        &self,
        username: &str,
        password: &str,
        full_name: &str,
        email: &str,
        role: &str,
    ) -> Result<(), String> {
        match self {
            DbPool::Sqlite(pool) => {
                sqlx::query("INSERT INTO users (username, password, full_name, email, role) VALUES (?1, ?2, ?3, ?4, ?5)")
                    .bind(username).bind(password).bind(full_name).bind(email).bind(role)
                    .execute(pool).await.map_err(|e| e.to_string())?;
                Ok(())
            }
            DbPool::Postgres(pool) => {
                sqlx::query("INSERT INTO users (username, password, full_name, email, role) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password, full_name = EXCLUDED.full_name, email = EXCLUDED.email, role = EXCLUDED.role")
                    .bind(username).bind(password).bind(full_name).bind(email).bind(role)
                    .execute(pool).await.map_err(|e| e.to_string())?;
                Ok(())
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let mut q = Query::new(
                    "INSERT INTO users (username, password, full_name, email, role) VALUES (@P1, @P2, @P3, @P4, @P5)",
                );
                q.bind(username);
                q.bind(password);
                q.bind(full_name);
                q.bind(email);
                q.bind(role);
                q.execute(&mut *conn).await.map_err(|e| e.to_string())?;
                Ok(())
            }
        }
    }

    pub async fn is_user_active(&self, user_id: i64) -> Result<bool, String> {
        match self {
            DbPool::Sqlite(pool) => {
                let row = sqlx::query("SELECT active FROM users WHERE id = ?1")
                    .bind(user_id)
                    .fetch_optional(pool)
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(row.map(|r| r.get::<bool, _>(0)).unwrap_or(false))
            }
            DbPool::Postgres(pool) => {
                let row = sqlx::query("SELECT active FROM users WHERE id = $1")
                    .bind(user_id)
                    .fetch_optional(pool)
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(row.map(|r| r.get::<bool, _>(0)).unwrap_or(false))
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let mut q = tiberius::Query::new("SELECT active FROM users WHERE id = @P1");
                q.bind(user_id as i32);
                let stream = q.query(&mut *conn).await.map_err(|e| e.to_string())?;
                let rows: Vec<tiberius::Row> = stream
                    .into_first_result()
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(rows
                    .first()
                    .and_then(|r| r.get::<bool, _>(0))
                    .unwrap_or(false))
            }
        }
    }

    pub async fn update_user_password(&self, user_id: i64, value: &str) -> Result<(), String> {
        self.exec_update_field("password", user_id, value).await
    }

    pub async fn update_user_full_name(&self, user_id: i64, value: &str) -> Result<(), String> {
        self.exec_update_field("full_name", user_id, value).await
    }

    pub async fn update_user_email(&self, user_id: i64, value: &str) -> Result<(), String> {
        self.exec_update_field("email", user_id, value).await
    }

    pub async fn update_user_role(&self, user_id: i64, value: &str) -> Result<(), String> {
        self.exec_update_field("role", user_id, value).await
    }

    async fn exec_update_field(
        &self,
        field: &str,
        user_id: i64,
        value: &str,
    ) -> Result<(), String> {
        let sql_suffix = match field {
            "password" | "full_name" | "email" | "role" => field,
            _ => return Err(format!("Field '{}' not allowed", field)),
        };
        match self {
            DbPool::Sqlite(pool) => {
                let sql = format!("UPDATE users SET {} = ?1 WHERE id = ?2", sql_suffix);
                sqlx::query(&sql)
                    .bind(value)
                    .bind(user_id)
                    .execute(pool)
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(())
            }
            DbPool::Postgres(pool) => {
                let sql = format!("UPDATE users SET {} = $1 WHERE id = $2", sql_suffix);
                sqlx::query(&sql)
                    .bind(value)
                    .bind(user_id)
                    .execute(pool)
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(())
            }
            DbPool::Mssql(pool) => {
                let sql = format!("UPDATE users SET {} = @P1 WHERE id = @P2", sql_suffix);
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let mut q = Query::new(sql);
                q.bind(value);
                q.bind(user_id as i32);
                q.execute(&mut *conn).await.map_err(|e| e.to_string())?;
                Ok(())
            }
        }
    }

    pub async fn update_user_active(&self, user_id: i64, active: bool) -> Result<(), String> {
        match self {
            DbPool::Sqlite(pool) => {
                sqlx::query("UPDATE users SET active = ?1 WHERE id = ?2")
                    .bind(active)
                    .bind(user_id)
                    .execute(pool)
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(())
            }
            DbPool::Postgres(pool) => {
                sqlx::query("UPDATE users SET active = $1 WHERE id = $2")
                    .bind(active)
                    .bind(user_id)
                    .execute(pool)
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(())
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let mut q = Query::new("UPDATE users SET active = @P1 WHERE id = @P2");
                q.bind(active);
                q.bind(user_id as i32);
                q.execute(&mut *conn).await.map_err(|e| e.to_string())?;
                Ok(())
            }
        }
    }

    pub async fn delete_user(&self, user_id: i64) -> Result<(), String> {
        match self {
            DbPool::Sqlite(pool) => {
                sqlx::query("DELETE FROM users WHERE id = ?1")
                    .bind(user_id)
                    .execute(pool)
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(())
            }
            DbPool::Postgres(pool) => {
                sqlx::query("DELETE FROM users WHERE id = $1")
                    .bind(user_id)
                    .execute(pool)
                    .await
                    .map_err(|e| e.to_string())?;
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
                Ok(rows
                    .into_iter()
                    .map(|r| {
                        build_equivalence_row(
                            r.get::<i64, _>(0),
                            r.get::<String, _>(1),
                            r.get::<f64, _>(2),
                            r.get::<String, _>(3),
                        )
                    })
                    .collect())
            }
            DbPool::Postgres(pool) => {
                let rows = sqlx::query("SELECT ae.signal_id, s.internal_name, ae.numeric_value, ae.display_name FROM attribute_equivalences ae JOIN signals s ON ae.signal_id = s.id ORDER BY s.internal_name, ae.numeric_value")
                    .fetch_all(pool).await.map_err(|e| e.to_string())?;
                Ok(rows
                    .into_iter()
                    .map(|r| {
                        build_equivalence_row(
                            r.get::<i64, _>(0),
                            r.get::<String, _>(1),
                            r.get::<f64, _>(2),
                            r.get::<String, _>(3),
                        )
                    })
                    .collect())
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let q = Query::new(
                    "SELECT ae.signal_id, s.internal_name, ae.numeric_value, ae.display_name FROM attribute_equivalences ae JOIN signals s ON ae.signal_id = s.id ORDER BY s.internal_name, ae.numeric_value",
                );
                let stream = q.query(&mut *conn).await.map_err(|e| e.to_string())?;
                let rows: Vec<TibRow> = stream
                    .into_first_result()
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(rows
                    .into_iter()
                    .map(|r: TibRow| {
                        build_equivalence_row(
                            r.get::<i32, _>(0).map(|v| v as i64).unwrap_or(0),
                            r.get::<&str, _>(1).unwrap_or("").to_string(),
                            r.get::<f64, _>(2).unwrap_or(0.0),
                            r.get::<&str, _>(3).unwrap_or("").to_string(),
                        )
                    })
                    .collect())
            }
        }
    }

    pub async fn get_or_create_signal(&self, internal_name: &str) -> Result<i64, String> {
        match self {
            DbPool::Sqlite(pool) => {
                sqlx::query("INSERT OR IGNORE INTO signals (internal_name) VALUES (?1)")
                    .bind(internal_name)
                    .execute(pool)
                    .await
                    .map_err(|e| e.to_string())?;
                let row = sqlx::query("SELECT id FROM signals WHERE internal_name = ?1")
                    .bind(internal_name)
                    .fetch_one(pool)
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(row.get::<i64, _>(0))
            }
            DbPool::Postgres(pool) => {
                sqlx::query("INSERT INTO signals (internal_name) VALUES ($1) ON CONFLICT (internal_name) DO NOTHING")
                    .bind(internal_name).execute(pool).await.map_err(|e| e.to_string())?;
                let row = sqlx::query("SELECT id FROM signals WHERE internal_name = $1")
                    .bind(internal_name)
                    .fetch_one(pool)
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(row.get::<i64, _>(0))
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let mut q1 = Query::new(
                    "IF NOT EXISTS (SELECT 1 FROM signals WHERE internal_name = @P1) INSERT INTO signals (internal_name) VALUES (@P1)",
                );
                q1.bind(internal_name);
                q1.execute(&mut *conn).await.map_err(|e| e.to_string())?;
                let mut q2 = Query::new("SELECT id FROM signals WHERE internal_name = @P1");
                q2.bind(internal_name);
                let stream = q2.query(&mut *conn).await.map_err(|e| e.to_string())?;
                let rows: Vec<TibRow> = stream
                    .into_first_result()
                    .await
                    .map_err(|e| e.to_string())?;
                let id = rows
                    .first()
                    .and_then(|r: &TibRow| r.get::<i32, _>(0))
                    .ok_or("Signal not found")?;
                Ok(id as i64)
            }
        }
    }

    pub async fn upsert_equivalence(
        &self,
        signal_id: i64,
        numeric_value: f64,
        display_name: &str,
    ) -> Result<(), String> {
        match self {
            DbPool::Sqlite(pool) => {
                sqlx::query("INSERT OR REPLACE INTO attribute_equivalences (signal_id, numeric_value, display_name) VALUES (?1, ?2, ?3)")
                    .bind(signal_id).bind(numeric_value).bind(display_name).execute(pool).await.map_err(|e| e.to_string())?;
                Ok(())
            }
            DbPool::Postgres(pool) => {
                sqlx::query("INSERT INTO attribute_equivalences (signal_id, numeric_value, display_name) VALUES ($1, $2, $3) ON CONFLICT (signal_id, numeric_value) DO UPDATE SET display_name = EXCLUDED.display_name")
                    .bind(signal_id).bind(numeric_value).bind(display_name).execute(pool).await.map_err(|e| e.to_string())?;
                Ok(())
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let mut q = Query::new(
                    "MERGE attribute_equivalences AS tgt USING (SELECT @P1 AS signal_id, @P2 AS numeric_value) AS src ON tgt.signal_id = src.signal_id AND tgt.numeric_value = src.numeric_value WHEN MATCHED THEN UPDATE SET display_name = @P3 WHEN NOT MATCHED THEN INSERT (signal_id, numeric_value, display_name) VALUES (@P1, @P2, @P3);",
                );
                q.bind(signal_id as i32);
                q.bind(numeric_value);
                q.bind(display_name);
                q.execute(&mut *conn).await.map_err(|e| e.to_string())?;
                Ok(())
            }
        }
    }

    pub async fn update_equivalence(
        &self,
        signal_id: i64,
        numeric_value: f64,
        display_name: &str,
    ) -> Result<(), String> {
        match self {
            DbPool::Sqlite(pool) => {
                sqlx::query("UPDATE attribute_equivalences SET display_name = ?1 WHERE signal_id = ?2 AND numeric_value = ?3")
                    .bind(display_name).bind(signal_id).bind(numeric_value).execute(pool).await.map_err(|e| e.to_string())?;
                Ok(())
            }
            DbPool::Postgres(pool) => {
                sqlx::query("UPDATE attribute_equivalences SET display_name = $1 WHERE signal_id = $2 AND numeric_value = $3")
                    .bind(display_name).bind(signal_id).bind(numeric_value).execute(pool).await.map_err(|e| e.to_string())?;
                Ok(())
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let mut q = Query::new(
                    "UPDATE attribute_equivalences SET display_name = @P1 WHERE signal_id = @P2 AND numeric_value = @P3",
                );
                q.bind(display_name);
                q.bind(signal_id as i32);
                q.bind(numeric_value);
                q.execute(&mut *conn).await.map_err(|e| e.to_string())?;
                Ok(())
            }
        }
    }

    pub async fn delete_equivalence_with_log(
        &self,
        signal_id: i64,
        numeric_value: f64,
        deleted_by: &str,
        deletion_reason: &str,
    ) -> Result<(), String> {
        match self {
            DbPool::Sqlite(pool) => {
                let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
                sqlx::query("INSERT INTO equivalence_deletion_log (signal_id, numeric_value, deleted_by, deletion_reason) VALUES (?1, ?2, ?3, ?4)")
                    .bind(signal_id).bind(numeric_value).bind(deleted_by).bind(deletion_reason).execute(&mut *tx).await.map_err(|e| e.to_string())?;
                sqlx::query("DELETE FROM attribute_equivalences WHERE signal_id = ?1 AND numeric_value = ?2")
                    .bind(signal_id).bind(numeric_value).execute(&mut *tx).await.map_err(|e| e.to_string())?;
                tx.commit().await.map_err(|e| e.to_string())?;
                Ok(())
            }
            DbPool::Postgres(pool) => {
                let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
                sqlx::query("INSERT INTO equivalence_deletion_log (signal_id, numeric_value, deleted_by, deletion_reason) VALUES ($1, $2, $3, $4)")
                    .bind(signal_id).bind(numeric_value).bind(deleted_by).bind(deletion_reason).execute(&mut *tx).await.map_err(|e| e.to_string())?;
                sqlx::query("DELETE FROM attribute_equivalences WHERE signal_id = $1 AND numeric_value = $2")
                    .bind(signal_id).bind(numeric_value).execute(&mut *tx).await.map_err(|e| e.to_string())?;
                tx.commit().await.map_err(|e| e.to_string())?;
                Ok(())
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                // Manual BEGIN/COMMIT for tiberius (no built-in transaction helper)
                Query::new("BEGIN TRANSACTION").execute(&mut *conn).await.map_err(|e| e.to_string())?;
                let mut q1 = Query::new(
                    "INSERT INTO equivalence_deletion_log (signal_id, numeric_value, deleted_by, deletion_reason) VALUES (@P1, @P2, @P3, @P4)",
                );
                q1.bind(signal_id as i32);
                q1.bind(numeric_value);
                q1.bind(deleted_by);
                q1.bind(deletion_reason);
                if let Err(e) = q1.execute(&mut *conn).await {
                    let _ = Query::new("ROLLBACK").execute(&mut *conn).await;
                    return Err(e.to_string());
                }
                let mut q2 = Query::new(
                    "DELETE FROM attribute_equivalences WHERE signal_id = @P1 AND numeric_value = @P2",
                );
                q2.bind(signal_id as i32);
                q2.bind(numeric_value);
                if let Err(e) = q2.execute(&mut *conn).await {
                    let _ = Query::new("ROLLBACK").execute(&mut *conn).await;
                    return Err(e.to_string());
                }
                Query::new("COMMIT").execute(&mut *conn).await.map_err(|e| e.to_string())?;
                Ok(())
            }
        }
    }

    // ─── PATIENT / TELEMETRY ──────────────────────────────────

    pub async fn list_patients(&self) -> Result<Vec<GenericRow>, String> {
        match self {
            DbPool::Sqlite(pool) => {
                let rows = sqlx::query(
                    "SELECT id, patient_id_str, created_at FROM patients ORDER BY created_at DESC",
                )
                .fetch_all(pool)
                .await
                .map_err(|e| e.to_string())?;
                Ok(rows
                    .into_iter()
                    .map(|r| {
                        build_patient_row(
                            r.get::<i64, _>(0),
                            r.get::<String, _>(1),
                            r.get::<String, _>(2),
                        )
                    })
                    .collect())
            }
            DbPool::Postgres(pool) => {
                let rows = sqlx::query("SELECT id, patient_id_str, TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') FROM patients ORDER BY created_at DESC")
                    .fetch_all(pool).await.map_err(|e| e.to_string())?;
                Ok(rows
                    .into_iter()
                    .map(|r| {
                        build_patient_row(
                            r.get::<i64, _>(0),
                            r.get::<String, _>(1),
                            r.get::<String, _>(2),
                        )
                    })
                    .collect())
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let q = Query::new(
                    "SELECT id, patient_id_str, CONVERT(NVARCHAR(30), created_at, 120) FROM patients ORDER BY created_at DESC",
                );
                let stream = q.query(&mut *conn).await.map_err(|e| e.to_string())?;
                let rows: Vec<TibRow> = stream
                    .into_first_result()
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(rows
                    .into_iter()
                    .map(|r: TibRow| {
                        build_patient_row(
                            r.get::<i32, _>(0).map(|v| v as i64).unwrap_or(0),
                            r.get::<&str, _>(1).unwrap_or("").to_string(),
                            r.get::<&str, _>(2).unwrap_or("").to_string(),
                        )
                    })
                    .collect())
            }
        }
    }

    pub async fn list_therapies(
        &self,
        search: Option<&str>,
        status_filter: Option<&str>,
        page: i64,
        page_size: i64,
    ) -> Result<(Vec<GenericRow>, i64), String> {
        let search_pattern = search
            .map(|s| format!("%{}%", s))
            .unwrap_or_else(|| "%".to_string());
        let status = status_filter.unwrap_or("");
        let offset = (page - 1) * page_size;
        let where_clause = "WHERE (p.patient_id_str LIKE ?1 OR m.serial_number LIKE ?1 OR m.software_version LIKE ?1 OR COALESCE(th.status, '') LIKE ?1)
                            AND (?2 = '' OR th.status = ?2)";
        let where_clause_pg = "WHERE (p.patient_id_str LIKE $1 OR m.serial_number LIKE $1 OR m.software_version LIKE $1 OR COALESCE(th.status, '') LIKE $1)
                               AND ($2 = '' OR th.status = $2)";
        let where_clause_ms = "WHERE (p.patient_id_str LIKE @P1 OR m.serial_number LIKE @P1 OR m.software_version LIKE @P1 OR ISNULL(th.status, '') LIKE @P1)
                               AND (@P2 = '' OR th.status = @P2)";
        match self {
            DbPool::Sqlite(pool) => {
                let total = sqlx::query_scalar::<_, i64>(
                    &format!("SELECT COUNT(*) FROM therapies th JOIN patients p ON th.patient_id = p.id JOIN machines m ON th.machine_id = m.id {}", where_clause)
                )
                .bind(&search_pattern)
                .bind(status)
                .fetch_one(pool).await.map_err(|e| e.to_string())?;

                let rows = sqlx::query(
                    &format!(
                        "SELECT th.id, th.started_at, th.ended_at, COALESCE(th.status, ''), p.id, p.patient_id_str, m.id, m.serial_number, m.software_version, th.serial_session_id
                         FROM therapies th
                         JOIN patients p ON th.patient_id = p.id
                         JOIN machines m ON th.machine_id = m.id
                         {}
                         ORDER BY th.started_at DESC LIMIT ?3 OFFSET ?4", where_clause
                    )
                )
                .bind(&search_pattern)
                .bind(status)
                .bind(page_size)
                .bind(offset)
                .fetch_all(pool).await.map_err(|e| e.to_string())?;
                Ok((
                    rows.into_iter()
                        .map(|r| {
                            build_therapy_row(
                                r.get::<i64, _>(0),
                                r.get::<String, _>(1),
                                r.get::<Option<String>, _>(2),
                                r.get::<String, _>(3),
                                r.get::<i64, _>(4),
                                r.get::<String, _>(5),
                                r.get::<i64, _>(6),
                                r.get::<String, _>(7),
                                r.get::<String, _>(8),
                                r.get::<Option<i64>, _>(9),
                            )
                        })
                        .collect(),
                    total,
                ))
            }
            DbPool::Postgres(pool) => {
                let total = sqlx::query_scalar::<_, i64>(
                    &format!("SELECT COUNT(*) FROM therapies th JOIN patients p ON th.patient_id = p.id JOIN machines m ON th.machine_id = m.id {}", where_clause_pg)
                )
                .bind(&search_pattern)
                .bind(status)
                .fetch_one(pool).await.map_err(|e| e.to_string())?;

                let rows = sqlx::query(
                    &format!(
                        "SELECT th.id, TO_CHAR(th.started_at, 'YYYY-MM-DD HH24:MI:SS'), CASE WHEN th.ended_at IS NULL THEN NULL ELSE TO_CHAR(th.ended_at, 'YYYY-MM-DD HH24:MI:SS') END, COALESCE(th.status, ''), p.id, p.patient_id_str, m.id, m.serial_number, m.software_version, th.serial_session_id
                         FROM therapies th
                         JOIN patients p ON th.patient_id = p.id
                         JOIN machines m ON th.machine_id = m.id
                         {}
                         ORDER BY th.started_at DESC LIMIT $3 OFFSET $4", where_clause_pg
                    )
                )
                .bind(&search_pattern)
                .bind(status)
                .bind(page_size)
                .bind(offset)
                .fetch_all(pool).await.map_err(|e| e.to_string())?;
                Ok((
                    rows.into_iter()
                        .map(|r| {
                            build_therapy_row(
                                r.get::<i64, _>(0),
                                r.get::<String, _>(1),
                                r.get::<Option<String>, _>(2),
                                r.get::<String, _>(3),
                                r.get::<i64, _>(4),
                                r.get::<String, _>(5),
                                r.get::<i64, _>(6),
                                r.get::<String, _>(7),
                                r.get::<String, _>(8),
                                r.get::<Option<i64>, _>(9),
                            )
                        })
                        .collect(),
                    total,
                ))
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;

                let count_sql = format!(
                    "SELECT COUNT(*) FROM therapies th JOIN patients p ON th.patient_id = p.id JOIN machines m ON th.machine_id = m.id {}",
                    where_clause_ms
                );
                let mut qc = Query::new(&count_sql);
                qc.bind(&search_pattern);
                qc.bind(status);
                let stream = qc.query(&mut *conn).await.map_err(|e| e.to_string())?;
                let count_rows: Vec<TibRow> = stream
                    .into_first_result()
                    .await
                    .map_err(|e| e.to_string())?;
                let total = count_rows
                    .first()
                    .and_then(|r| r.get::<i32, _>(0))
                    .unwrap_or(0) as i64;

                let data_sql = format!(
                    "SELECT th.id, CONVERT(NVARCHAR(30), th.started_at, 120), CONVERT(NVARCHAR(30), th.ended_at, 120), ISNULL(th.status, ''), p.id, p.patient_id_str, m.id, m.serial_number, m.software_version, th.serial_session_id
                     FROM therapies th
                     JOIN patients p ON th.patient_id = p.id
                     JOIN machines m ON th.machine_id = m.id
                     {}
                     ORDER BY th.started_at DESC OFFSET @P4 ROWS FETCH NEXT @P3 ROWS ONLY", where_clause_ms
                );
                let mut q = Query::new(&data_sql);
                q.bind(&search_pattern);
                q.bind(status);
                q.bind(page_size);
                q.bind(offset);
                let stream = q.query(&mut *conn).await.map_err(|e| e.to_string())?;
                let rows: Vec<TibRow> = stream
                    .into_first_result()
                    .await
                    .map_err(|e| e.to_string())?;
                Ok((
                    rows.into_iter()
                        .map(|r: TibRow| {
                            build_therapy_row(
                                r.get::<i32, _>(0).map(|v| v as i64).unwrap_or(0),
                                r.get::<&str, _>(1).unwrap_or("").to_string(),
                                r.get::<&str, _>(2).map(|v| v.to_string()),
                                r.get::<&str, _>(3).unwrap_or("").to_string(),
                                r.get::<i32, _>(4).map(|v| v as i64).unwrap_or(0),
                                r.get::<&str, _>(5).unwrap_or("").to_string(),
                                r.get::<i32, _>(6).map(|v| v as i64).unwrap_or(0),
                                r.get::<&str, _>(7).unwrap_or("").to_string(),
                                r.get::<&str, _>(8).unwrap_or("").to_string(),
                                r.get::<i32, _>(9).map(|v| v as i64),
                            )
                        })
                        .collect(),
                    total,
                ))
            }
        }
    }

    pub async fn list_session_readings(
        &self,
        session_id: i64,
        limit: u32,
    ) -> Result<Vec<GenericRow>, String> {
        match self {
            DbPool::Sqlite(pool) => {
                let rows = sqlx::query(
                    "SELECT sr.id, sr.timestamp, s.internal_name, CAST(sr.physical_value AS TEXT), sr.raw_value, sr.unit, sr.display_value, sr.phase
                     FROM session_readings sr
                     JOIN signals s ON sr.signal_id = s.id
                     WHERE sr.serial_session_id = ?1
                     ORDER BY sr.timestamp DESC LIMIT ?2"
                )
                .bind(session_id).bind(limit)
                .fetch_all(pool).await.map_err(|e| e.to_string())?;
                Ok(rows
                    .into_iter()
                    .map(|r| GenericRow {
                        values: vec![
                            Some(r.get::<i64, _>(0).to_string()),
                            Some(r.get::<String, _>(1)),
                            Some(r.get::<String, _>(2)),
                            Some(r.get::<String, _>(3)),
                            Some(r.get::<i64, _>(4).to_string()),
                            Some(r.get::<String, _>(5)),
                            r.get::<Option<String>, _>(6),
                            r.get::<Option<String>, _>(7),
                        ],
                    })
                    .collect())
            }
            DbPool::Postgres(pool) => {
                let rows = sqlx::query(
                    "SELECT sr.id, TO_CHAR(sr.timestamp, 'YYYY-MM-DD HH24:MI:SS'), s.internal_name, CAST(sr.physical_value AS TEXT), sr.raw_value, sr.unit, sr.display_value, sr.phase
                     FROM session_readings sr
                     JOIN signals s ON sr.signal_id = s.id
                     WHERE sr.serial_session_id = $1
                     ORDER BY sr.timestamp DESC LIMIT $2"
                )
                .bind(session_id).bind(limit as i64)
                .fetch_all(pool).await.map_err(|e| e.to_string())?;
                Ok(rows
                    .into_iter()
                    .map(|r| GenericRow {
                        values: vec![
                            Some(r.get::<i64, _>(0).to_string()),
                            Some(r.get::<String, _>(1)),
                            Some(r.get::<String, _>(2)),
                            Some(r.get::<String, _>(3)),
                            Some(r.get::<i64, _>(4).to_string()),
                            Some(r.get::<String, _>(5)),
                            r.get::<Option<String>, _>(6),
                            r.get::<Option<String>, _>(7),
                        ],
                    })
                    .collect())
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let mut q = Query::new(
                    "SELECT TOP(@P1) sr.id, CONVERT(NVARCHAR(30), sr.timestamp, 120), s.internal_name, CAST(sr.physical_value AS NVARCHAR(MAX)), sr.raw_value, sr.unit, sr.display_value, sr.phase
                     FROM session_readings sr
                     JOIN signals s ON sr.signal_id = s.id
                     WHERE sr.serial_session_id = @P2
                     ORDER BY sr.timestamp DESC"
                );
                q.bind(limit as i32);
                q.bind(session_id as i32);
                let stream = q.query(&mut *conn).await.map_err(|e| e.to_string())?;
                let rows: Vec<TibRow> = stream
                    .into_first_result()
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(rows
                    .into_iter()
                    .map(|r: TibRow| GenericRow {
                        values: vec![
                            r.get::<i32, _>(0).map(|v| v.to_string()),
                            r.get::<&str, _>(1).map(|v| v.to_string()),
                            r.get::<&str, _>(2).map(|v| v.to_string()),
                            r.get::<&str, _>(3).map(|v| v.to_string()),
                            r.get::<i64, _>(4).map(|v| v.to_string()),
                            r.get::<&str, _>(5).map(|v| v.to_string()),
                            r.get::<&str, _>(6).map(|v| v.to_string()),
                            r.get::<&str, _>(7).map(|v| v.to_string()),
                        ],
                    })
                    .collect())
            }
        }
    }

    pub async fn patient_history(
        &self,
        patient_id_str: &str,
        limit: u32,
    ) -> Result<Vec<GenericRow>, String> {
        match self {
            DbPool::Sqlite(pool) => {
                let rows = sqlx::query(&format!(
                    "SELECT t.id, t.timestamp, s.internal_name, CAST(t.physical_value AS TEXT), e.display_name, t.unit FROM telemetry t JOIN patients p ON t.patient_id = p.id JOIN signals s ON t.signal_id = s.id LEFT JOIN attribute_equivalences e ON s.id = e.signal_id AND {} = e.numeric_value WHERE p.patient_id_str = ?1 ORDER BY t.timestamp DESC LIMIT ?2",
                    SQLITE_NUMERIC_EQ_EXPR
                )).bind(patient_id_str).bind(limit).fetch_all(pool).await.map_err(|e| e.to_string())?;
                Ok(rows
                    .into_iter()
                    .map(|r| {
                        build_history_row(
                            r.get::<i64, _>(0),
                            r.get::<String, _>(1),
                            r.get::<String, _>(2),
                            r.get::<String, _>(3),
                            r.get::<Option<String>, _>(4),
                            r.get::<String, _>(5),
                        )
                    })
                    .collect())
            }
            DbPool::Postgres(pool) => {
                let rows = sqlx::query(&format!(
                    "SELECT t.id, TO_CHAR(t.timestamp, 'YYYY-MM-DD HH24:MI:SS'), s.internal_name, CAST(t.physical_value AS TEXT), e.display_name, t.unit FROM telemetry t JOIN patients p ON t.patient_id = p.id JOIN signals s ON t.signal_id = s.id LEFT JOIN attribute_equivalences e ON s.id = e.signal_id AND {} = e.numeric_value WHERE p.patient_id_str = $1 ORDER BY t.timestamp DESC LIMIT $2",
                    POSTGRES_NUMERIC_EQ_EXPR
                )).bind(patient_id_str).bind(limit as i64).fetch_all(pool).await.map_err(|e| e.to_string())?;
                Ok(rows
                    .into_iter()
                    .map(|r| {
                        build_history_row(
                            r.get::<i64, _>(0),
                            r.get::<String, _>(1),
                            r.get::<String, _>(2),
                            r.get::<String, _>(3),
                            r.get::<Option<String>, _>(4),
                            r.get::<String, _>(5),
                        )
                    })
                    .collect())
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let query = format!(
                    "SELECT TOP(@P1) t.id, CONVERT(NVARCHAR(30), t.timestamp, 120), s.internal_name, CAST(t.physical_value AS NVARCHAR(MAX)), e.display_name, t.unit FROM telemetry t JOIN patients p ON t.patient_id = p.id JOIN signals s ON t.signal_id = s.id LEFT JOIN attribute_equivalences e ON s.id = e.signal_id AND {} = e.numeric_value WHERE p.patient_id_str = @P2 ORDER BY t.timestamp DESC",
                    MSSQL_NUMERIC_EQ_EXPR
                );
                let mut q = Query::new(query);
                q.bind(limit as i32);
                q.bind(patient_id_str);
                let stream = q.query(&mut *conn).await.map_err(|e| e.to_string())?;
                let rows: Vec<TibRow> = stream
                    .into_first_result()
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(rows
                    .into_iter()
                    .map(|r: TibRow| {
                        build_history_row(
                            r.get::<i32, _>(0).map(|v| v as i64).unwrap_or(0),
                            r.get::<&str, _>(1).unwrap_or("").to_string(),
                            r.get::<&str, _>(2).unwrap_or("").to_string(),
                            r.get::<&str, _>(3).unwrap_or("").to_string(),
                            r.get::<&str, _>(4).map(|v| v.to_string()),
                            r.get::<&str, _>(5).unwrap_or("").to_string(),
                        )
                    })
                    .collect())
            }
        }
    }

    pub async fn therapy_history(
        &self,
        therapy_id: i64,
        limit: u32,
    ) -> Result<Vec<GenericRow>, String> {
        match self {
            DbPool::Sqlite(pool) => {
                let rows = sqlx::query(&format!(
                    "SELECT t.id, t.timestamp, s.internal_name, CAST(t.physical_value AS TEXT), e.display_name, t.unit
                     FROM telemetry t
                     JOIN therapies th ON t.therapy_id = th.id
                     JOIN signals s ON t.signal_id = s.id
                     LEFT JOIN attribute_equivalences e ON s.id = e.signal_id AND {} = e.numeric_value
                     WHERE th.id = ?1 ORDER BY t.timestamp DESC LIMIT ?2",
                    SQLITE_NUMERIC_EQ_EXPR
                )).bind(therapy_id).bind(limit).fetch_all(pool).await.map_err(|e| e.to_string())?;
                Ok(rows
                    .into_iter()
                    .map(|r| {
                        build_history_row(
                            r.get::<i64, _>(0),
                            r.get::<String, _>(1),
                            r.get::<String, _>(2),
                            r.get::<String, _>(3),
                            r.get::<Option<String>, _>(4),
                            r.get::<String, _>(5),
                        )
                    })
                    .collect())
            }
            DbPool::Postgres(pool) => {
                let rows = sqlx::query(&format!(
                    "SELECT t.id, TO_CHAR(t.timestamp, 'YYYY-MM-DD HH24:MI:SS'), s.internal_name, CAST(t.physical_value AS TEXT), e.display_name, t.unit
                     FROM telemetry t
                     JOIN therapies th ON t.therapy_id = th.id
                     JOIN signals s ON t.signal_id = s.id
                     LEFT JOIN attribute_equivalences e ON s.id = e.signal_id AND {} = e.numeric_value
                     WHERE th.id = $1 ORDER BY t.timestamp DESC LIMIT $2",
                    POSTGRES_NUMERIC_EQ_EXPR
                )).bind(therapy_id).bind(limit as i64).fetch_all(pool).await.map_err(|e| e.to_string())?;
                Ok(rows
                    .into_iter()
                    .map(|r| {
                        build_history_row(
                            r.get::<i64, _>(0),
                            r.get::<String, _>(1),
                            r.get::<String, _>(2),
                            r.get::<String, _>(3),
                            r.get::<Option<String>, _>(4),
                            r.get::<String, _>(5),
                        )
                    })
                    .collect())
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let query = format!(
                    "SELECT TOP(@P1) t.id, CONVERT(NVARCHAR(30), t.timestamp, 120), s.internal_name, CAST(t.physical_value AS NVARCHAR(MAX)), e.display_name, t.unit
                     FROM telemetry t
                     JOIN therapies th ON t.therapy_id = th.id
                     JOIN signals s ON t.signal_id = s.id
                     LEFT JOIN attribute_equivalences e ON s.id = e.signal_id AND {} = e.numeric_value
                     WHERE th.id = @P2 ORDER BY t.timestamp DESC",
                    MSSQL_NUMERIC_EQ_EXPR
                );
                let mut q = Query::new(query);
                q.bind(limit as i32);
                q.bind(therapy_id as i32);
                let stream = q.query(&mut *conn).await.map_err(|e| e.to_string())?;
                let rows: Vec<TibRow> = stream
                    .into_first_result()
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(rows
                    .into_iter()
                    .map(|r: TibRow| {
                        build_history_row(
                            r.get::<i32, _>(0).map(|v| v as i64).unwrap_or(0),
                            r.get::<&str, _>(1).unwrap_or("").to_string(),
                            r.get::<&str, _>(2).unwrap_or("").to_string(),
                            r.get::<&str, _>(3).unwrap_or("").to_string(),
                            r.get::<&str, _>(4).map(|v| v.to_string()),
                            r.get::<&str, _>(5).unwrap_or("").to_string(),
                        )
                    })
                    .collect())
            }
        }
    }

    pub async fn export_history(
        &self,
        patient_id_str: &str,
        limit: u32,
    ) -> Result<Vec<GenericRow>, String> {
        match self {
            DbPool::Sqlite(pool) => {
                let rows = sqlx::query(&format!(
                    "SELECT t.timestamp, s.internal_name, CAST(t.physical_value AS TEXT), e.display_name, t.unit FROM telemetry t JOIN patients p ON t.patient_id = p.id JOIN signals s ON t.signal_id = s.id LEFT JOIN attribute_equivalences e ON s.id = e.signal_id AND {} = e.numeric_value WHERE p.patient_id_str = ?1 ORDER BY t.timestamp ASC LIMIT ?2",
                    SQLITE_NUMERIC_EQ_EXPR
                )).bind(patient_id_str).bind(limit).fetch_all(pool).await.map_err(|e| e.to_string())?;
                Ok(rows
                    .into_iter()
                    .map(|r| {
                        build_export_row(
                            r.get::<String, _>(0),
                            r.get::<String, _>(1),
                            r.get::<String, _>(2),
                            r.get::<Option<String>, _>(3),
                            r.get::<String, _>(4),
                        )
                    })
                    .collect())
            }
            DbPool::Postgres(pool) => {
                let rows = sqlx::query(&format!(
                    "SELECT TO_CHAR(t.timestamp, 'YYYY-MM-DD HH24:MI:SS'), s.internal_name, CAST(t.physical_value AS TEXT), e.display_name, t.unit FROM telemetry t JOIN patients p ON t.patient_id = p.id JOIN signals s ON t.signal_id = s.id LEFT JOIN attribute_equivalences e ON s.id = e.signal_id AND {} = e.numeric_value WHERE p.patient_id_str = $1 ORDER BY t.timestamp ASC LIMIT $2",
                    POSTGRES_NUMERIC_EQ_EXPR
                )).bind(patient_id_str).bind(limit as i64).fetch_all(pool).await.map_err(|e| e.to_string())?;
                Ok(rows
                    .into_iter()
                    .map(|r| {
                        build_export_row(
                            r.get::<String, _>(0),
                            r.get::<String, _>(1),
                            r.get::<String, _>(2),
                            r.get::<Option<String>, _>(3),
                            r.get::<String, _>(4),
                        )
                    })
                    .collect())
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let query = format!(
                    "SELECT TOP(@P1) CONVERT(NVARCHAR(30), t.timestamp, 120), s.internal_name, CAST(t.physical_value AS NVARCHAR(MAX)), e.display_name, t.unit FROM telemetry t JOIN patients p ON t.patient_id = p.id JOIN signals s ON t.signal_id = s.id LEFT JOIN attribute_equivalences e ON s.id = e.signal_id AND {} = e.numeric_value WHERE p.patient_id_str = @P2 ORDER BY t.timestamp ASC",
                    MSSQL_NUMERIC_EQ_EXPR
                );
                let mut q = Query::new(query);
                q.bind(limit as i32);
                q.bind(patient_id_str);
                let stream = q.query(&mut *conn).await.map_err(|e| e.to_string())?;
                let rows: Vec<TibRow> = stream
                    .into_first_result()
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(rows
                    .into_iter()
                    .map(|r: TibRow| {
                        build_export_row(
                            r.get::<&str, _>(0).unwrap_or("").to_string(),
                            r.get::<&str, _>(1).unwrap_or("").to_string(),
                            r.get::<&str, _>(2).unwrap_or("").to_string(),
                            r.get::<&str, _>(3).map(|v| v.to_string()),
                            r.get::<&str, _>(4).unwrap_or("").to_string(),
                        )
                    })
                    .collect())
            }
        }
    }

    pub async fn export_therapy_history(
        &self,
        therapy_id: i64,
        limit: u32,
    ) -> Result<Vec<GenericRow>, String> {
        match self {
            DbPool::Sqlite(pool) => {
                let rows = sqlx::query(&format!(
                    "SELECT t.timestamp, s.internal_name, CAST(t.physical_value AS TEXT), e.display_name, t.unit
                     FROM telemetry t
                     JOIN therapies th ON t.therapy_id = th.id
                     JOIN signals s ON t.signal_id = s.id
                     LEFT JOIN attribute_equivalences e ON s.id = e.signal_id AND {} = e.numeric_value
                     WHERE th.id = ?1 ORDER BY t.timestamp ASC LIMIT ?2",
                    SQLITE_NUMERIC_EQ_EXPR
                )).bind(therapy_id).bind(limit).fetch_all(pool).await.map_err(|e| e.to_string())?;
                Ok(rows
                    .into_iter()
                    .map(|r| {
                        build_export_row(
                            r.get::<String, _>(0),
                            r.get::<String, _>(1),
                            r.get::<String, _>(2),
                            r.get::<Option<String>, _>(3),
                            r.get::<String, _>(4),
                        )
                    })
                    .collect())
            }
            DbPool::Postgres(pool) => {
                let rows = sqlx::query(&format!(
                    "SELECT TO_CHAR(t.timestamp, 'YYYY-MM-DD HH24:MI:SS'), s.internal_name, CAST(t.physical_value AS TEXT), e.display_name, t.unit
                     FROM telemetry t
                     JOIN therapies th ON t.therapy_id = th.id
                     JOIN signals s ON t.signal_id = s.id
                     LEFT JOIN attribute_equivalences e ON s.id = e.signal_id AND {} = e.numeric_value
                     WHERE th.id = $1 ORDER BY t.timestamp ASC LIMIT $2",
                    POSTGRES_NUMERIC_EQ_EXPR
                )).bind(therapy_id).bind(limit as i64).fetch_all(pool).await.map_err(|e| e.to_string())?;
                Ok(rows
                    .into_iter()
                    .map(|r| {
                        build_export_row(
                            r.get::<String, _>(0),
                            r.get::<String, _>(1),
                            r.get::<String, _>(2),
                            r.get::<Option<String>, _>(3),
                            r.get::<String, _>(4),
                        )
                    })
                    .collect())
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let query = format!(
                    "SELECT TOP(@P1) CONVERT(NVARCHAR(30), t.timestamp, 120), s.internal_name, CAST(t.physical_value AS NVARCHAR(MAX)), e.display_name, t.unit
                     FROM telemetry t
                     JOIN therapies th ON t.therapy_id = th.id
                     JOIN signals s ON t.signal_id = s.id
                     LEFT JOIN attribute_equivalences e ON s.id = e.signal_id AND {} = e.numeric_value
                     WHERE th.id = @P2 ORDER BY t.timestamp ASC",
                    MSSQL_NUMERIC_EQ_EXPR
                );
                let mut q = Query::new(query);
                q.bind(limit as i32);
                q.bind(therapy_id as i32);
                let stream = q.query(&mut *conn).await.map_err(|e| e.to_string())?;
                let rows: Vec<TibRow> = stream
                    .into_first_result()
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(rows
                    .into_iter()
                    .map(|r: TibRow| {
                        build_export_row(
                            r.get::<&str, _>(0).unwrap_or("").to_string(),
                            r.get::<&str, _>(1).unwrap_or("").to_string(),
                            r.get::<&str, _>(2).unwrap_or("").to_string(),
                            r.get::<&str, _>(3).map(|v| v.to_string()),
                            r.get::<&str, _>(4).unwrap_or("").to_string(),
                        )
                    })
                    .collect())
            }
        }
    }

    // ─── THERAPY COMMENTS ──────────────────────────────────────

    pub async fn list_therapy_comments(&self, therapy_id: i64) -> Result<Vec<GenericRow>, String> {
        match self {
            DbPool::Sqlite(pool) => {
                let rows = sqlx::query(
                    "SELECT id, therapy_id, author_name, comment, created_at, deleted_at, deletion_reason FROM therapy_comments WHERE therapy_id = ?1 AND deleted_at IS NULL ORDER BY created_at ASC"
                ).bind(therapy_id).fetch_all(pool).await.map_err(|e| e.to_string())?;
                Ok(rows
                    .into_iter()
                    .map(|r| {
                        build_therapy_comment_row(
                            r.get::<i64, _>(0),
                            r.get::<i64, _>(1),
                            r.get::<String, _>(2),
                            r.get::<String, _>(3),
                            r.get::<String, _>(4),
                            r.get::<Option<String>, _>(5),
                            r.get::<Option<String>, _>(6),
                        )
                    })
                    .collect())
            }
            DbPool::Postgres(pool) => {
                let rows = sqlx::query(
                    "SELECT id, therapy_id, author_name, comment, TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS'), TO_CHAR(deleted_at, 'YYYY-MM-DD HH24:MI:SS'), deletion_reason FROM therapy_comments WHERE therapy_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC"
                ).bind(therapy_id).fetch_all(pool).await.map_err(|e| e.to_string())?;
                Ok(rows
                    .into_iter()
                    .map(|r| {
                        build_therapy_comment_row(
                            r.get::<i64, _>(0),
                            r.get::<i64, _>(1),
                            r.get::<String, _>(2),
                            r.get::<String, _>(3),
                            r.get::<String, _>(4),
                            r.get::<Option<String>, _>(5),
                            r.get::<Option<String>, _>(6),
                        )
                    })
                    .collect())
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let mut q = Query::new(
                    "SELECT id, therapy_id, author_name, comment, CONVERT(NVARCHAR(30), created_at, 120), CONVERT(NVARCHAR(30), deleted_at, 120), deletion_reason FROM therapy_comments WHERE therapy_id = @P1 AND deleted_at IS NULL ORDER BY created_at ASC",
                );
                q.bind(therapy_id as i32);
                let stream = q.query(&mut *conn).await.map_err(|e| e.to_string())?;
                let rows: Vec<TibRow> = stream
                    .into_first_result()
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(rows
                    .into_iter()
                    .map(|r: TibRow| {
                        build_therapy_comment_row(
                            r.get::<i32, _>(0).map(|v| v as i64).unwrap_or(0),
                            r.get::<i32, _>(1).map(|v| v as i64).unwrap_or(0),
                            r.get::<&str, _>(2).unwrap_or("").to_string(),
                            r.get::<&str, _>(3).unwrap_or("").to_string(),
                            r.get::<&str, _>(4).unwrap_or("").to_string(),
                            r.get::<&str, _>(5).map(|s| s.to_string()),
                            r.get::<&str, _>(6).map(|s| s.to_string()),
                        )
                    })
                    .collect())
            }
        }
    }

    pub async fn create_therapy_comment(
        &self,
        therapy_id: i64,
        author_name: &str,
        comment: &str,
    ) -> Result<i64, String> {
        match self {
            DbPool::Sqlite(pool) => {
                let result = sqlx::query(
                    "INSERT INTO therapy_comments (therapy_id, author_name, comment) VALUES (?1, ?2, ?3)"
                ).bind(therapy_id).bind(author_name).bind(comment)
                    .execute(pool).await.map_err(|e| e.to_string())?;
                Ok(result.last_insert_rowid())
            }
            DbPool::Postgres(pool) => {
                let row = sqlx::query_scalar::<_, i64>(
                    "INSERT INTO therapy_comments (therapy_id, author_name, comment) VALUES ($1, $2, $3) RETURNING id"
                ).bind(therapy_id).bind(author_name).bind(comment)
                    .fetch_one(pool).await.map_err(|e| e.to_string())?;
                Ok(row)
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let mut q = Query::new(
                    "INSERT INTO therapy_comments (therapy_id, author_name, comment) OUTPUT INSERTED.id VALUES (@P1, @P2, @P3)",
                );
                q.bind(therapy_id as i32);
                q.bind(author_name);
                q.bind(comment);
                let stream = q.query(&mut *conn).await.map_err(|e| e.to_string())?;
                let rows: Vec<TibRow> = stream
                    .into_first_result()
                    .await
                    .map_err(|e| e.to_string())?;
                let id = rows
                    .first()
                    .and_then(|r: &TibRow| r.get::<i32, _>(0))
                    .unwrap_or(0);
                Ok(id as i64)
            }
        }
    }

    pub async fn soft_delete_therapy_comment(
        &self,
        comment_id: i64,
        reason: &str,
    ) -> Result<(), String> {
        match self {
            DbPool::Sqlite(pool) => {
                sqlx::query(
                    "UPDATE therapy_comments SET deleted_at = CURRENT_TIMESTAMP, deletion_reason = ?1 WHERE id = ?2"
                ).bind(reason).bind(comment_id).execute(pool).await.map_err(|e| e.to_string())?;
                Ok(())
            }
            DbPool::Postgres(pool) => {
                sqlx::query(
                    "UPDATE therapy_comments SET deleted_at = CURRENT_TIMESTAMP, deletion_reason = $1 WHERE id = $2"
                ).bind(reason).bind(comment_id).execute(pool).await.map_err(|e| e.to_string())?;
                Ok(())
            }
            DbPool::Mssql(pool) => {
                let mut conn = pool.get().await.map_err(|e| e.to_string())?;
                let mut q = Query::new(
                    "UPDATE therapy_comments SET deleted_at = GETUTCDATE(), deletion_reason = @P1 WHERE id = @P2",
                );
                q.bind(reason);
                q.bind(comment_id as i32);
                q.execute(&mut *conn).await.map_err(|e| e.to_string())?;
                Ok(())
            }
        }
    }
}

use std::time::{Duration, SystemTime, UNIX_EPOCH};

use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use argon2::password_hash::{Error as PasswordError, SaltString};
use argon2::password_hash::rand_core::OsRng;
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

const JWT_ISSUER: &str = "pdms-omni";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JwtClaims {
    pub user_id: i64,
    pub username: String,
    pub full_name: String,
    pub email: String,
    pub role: String,
    pub iat: usize,
    pub exp: usize,
    pub iss: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PasswordCheck {
    pub verified: bool,
    pub needs_upgrade: bool,
}

pub fn hash_password(password: &str) -> Result<String, PasswordError> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
}

pub fn verify_password(stored_password: &str, candidate: &str) -> PasswordCheck {
    if let Ok(parsed_hash) = PasswordHash::new(stored_password) {
        return match Argon2::default().verify_password(candidate.as_bytes(), &parsed_hash) {
            Ok(()) => PasswordCheck { verified: true, needs_upgrade: false },
            Err(_) => PasswordCheck { verified: false, needs_upgrade: false },
        };
    }

    let verified = stored_password == candidate;
    PasswordCheck {
        verified,
        needs_upgrade: verified,
    }
}

pub fn issue_token(secret: &str, claims: &JwtClaims, ttl: Duration) -> Result<String, jsonwebtoken::errors::Error> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as usize;
    let token_claims = JwtClaims {
        iat: now,
        exp: now + ttl.as_secs().max(1) as usize,
        iss: JWT_ISSUER.to_string(),
        ..claims.clone()
    };

    jsonwebtoken::encode(
        &Header::new(Algorithm::HS256),
        &token_claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

pub fn decode_token(secret: &str, token: &str) -> Result<JwtClaims, jsonwebtoken::errors::Error> {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.set_issuer(&[JWT_ISSUER]);
    validation.validate_exp = true;

    jsonwebtoken::decode::<JwtClaims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .map(|data| data.claims)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn password_hash_roundtrip() {
        let hash = hash_password("secret123").expect("hash");
        let check = verify_password(&hash, "secret123");
        assert!(check.verified);
        assert!(!check.needs_upgrade);
    }

    #[test]
    fn legacy_password_is_detected_for_upgrade() {
        let check = verify_password("plain123", "plain123");
        assert!(check.verified);
        assert!(check.needs_upgrade);
    }

    #[test]
    fn jwt_roundtrip() {
        let claims = JwtClaims {
            user_id: 1,
            username: "admin".to_string(),
            full_name: "Administrator".to_string(),
            email: "admin@example.com".to_string(),
            role: "admin".to_string(),
            iat: 0,
            exp: 0,
            iss: JWT_ISSUER.to_string(),
        };
        let token = issue_token("secret", &claims, Duration::from_secs(60)).expect("token");
        let decoded = decode_token("secret", &token).expect("decode");
        assert_eq!(decoded.user_id, 1);
        assert_eq!(decoded.username, "admin");
        assert_eq!(decoded.role, "admin");
    }
}
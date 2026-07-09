# PDMS-Omni

**Patient Data Management System** — Cliente Rust para el protocolo B. Braun OMNI-ODI (RS-232) con dashboard web en React/Vite.

Captura telemetría en tiempo real de monitores de diálisis B. Braun a través del puerto serial OMNI-ODI, la persiste en base de datos (SQLite / PostgreSQL / SQL Server) y la expone mediante WebSocket y API REST autenticada con JWT.

---

## Características

- **Protocolo OMNI-ODI** — comunicación RS-232 con dispositivos B. Braun (lectura cíclica de valores, inicialización, diccionario de etiquetas)
- **Múltiples backends de BD** — SQLite (desarrollo), PostgreSQL, Microsoft SQL Server
- **API REST segura** — JWT (HS256, Argon2 para contraseñas), roles `admin / operator / viewer`
- **Dashboard web** — React/Vite con WebSocket para telemetría en tiempo real
- **Arquitectura limpia** — dominio, aplicación e infraestructura desacoplados; el transporte serial y el backend de BD son intercambiables

---

## Requisitos

| Herramienta | Versión mínima |
|---|---|
| Rust | 1.80 (edition 2024) |
| Node.js | 18 |
| Puerto serial | COM / ttyUSB con cable OMNI-ODI |

---

## Configuración rápida

### 1. Clonar y configurar variables de entorno

```bash
git clone https://github.com/<tu-usuario>/pdms-omni.git
cd pdms-omni
cp .env.example .env
```

Edita `.env` y completa **todos** los valores marcados con `<CAMBIAR>`:

```env
# Secreto JWT — genera uno aleatorio:
JWT_SECRET=<salida de: openssl rand -hex 32>

# Contraseña del administrador inicial
ADMIN_PASSWORD=<contraseña-segura>

# Puerto serial del dispositivo
SERIAL_PORT=COM8          # Windows: COM8 | Linux: /dev/ttyUSB0
```

> ⚠️ **Nunca** commits el archivo `.env`. Está en `.gitignore` por defecto.

### 2. Compilar y ejecutar el backend

```bash
# Desarrollo
cargo run

# Producción
cargo build --release
./target/release/pdms-omni
```

El servidor estará disponible en `http://localhost:9001` (configurable con `WS_PORT`).

### 3. Dashboard (desarrollo)

```bash
cd dashboard-ts
npm install
npm run dev      # → http://localhost:5173
```

### 4. Dashboard (producción integrado)

```bash
cd dashboard-ts
npm run build
# El backend sirve el dashboard compilado automáticamente
# desde dashboard-ts/dist/ (configurable con DASHBOARD_DIR)
```

---

## Variables de entorno

Ver [`.env.example`](.env.example) para la lista completa con descripciones.

| Variable | Por defecto | Descripción |
|---|---|---|
| `SERIAL_PORT` | `COM6` | Puerto serial del dispositivo |
| `SERIAL_BAUDRATE` | `19200` | Velocidad del puerto |
| `DB_CONNECTION` | `sqlite` | Backend: `sqlite`, `mssql`, `postgres` |
| `WS_PORT` | `9001` | Puerto del servidor HTTP/WS |
| `JWT_SECRET` | — | **Requerido.** Mínimo 32 bytes aleatorios |
| `ADMIN_PASSWORD` | — | **Requerido.** Contraseña del primer usuario admin |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Orígenes permitidos (NO usar `*` en producción) |
| `CYCLE_INTERVAL` | `1` | Segundos entre lecturas del dispositivo |
| `DB_SAVE_INTERVAL` | `60` | Segundos entre guardados en BD |
| `DB_SAVE_ONLY_ON_THERAPY` | `true` | Guardar solo cuando haya terapia activa |
| `CAPTURE_MODE` | `all` | `all` o `selected` (filtrar por señales) |

---

## Seguridad

### Autenticación
- Contraseñas con **Argon2id** (estado del arte en hashing de contraseñas)
- Tokens **JWT HS256** con validación de expiración e issuer
- El WebSocket requiere autenticación con el primer mensaje (token JWT)
- Verificación de cuenta activa en cada petición API

### Recomendaciones para producción

1. **JWT_SECRET**: genera con `openssl rand -hex 32`. Nunca uses valores predecibles.
2. **CORS_ORIGINS**: lista explícita de orígenes. Nunca uses `*`.
3. **DB_TRUST_SERVER_CERTIFICATE**: cambia a `false` y usa un certificado TLS válido.
4. **WS_HOST**: usa `127.0.0.1` si hay un proxy reverso (nginx/caddy) delante.
5. **HTTPS/TLS**: coloca el servicio detrás de un proxy reverso con TLS en producción.

### Roles
| Rol | Permisos |
|---|---|
| `admin` | Acceso total: usuarios, equivalencias, export, control serial |
| `operator` | Lectura + export CSV, sin gestión de usuarios |
| `viewer` | Solo lectura de telemetría e historial |

---

## Arquitectura

```
src/
├── domain/          # Entidades, traits de repositorio, protocolo OMNI-ODI
├── application/     # OmniInteractor — orquesta el protocolo (sin I/O)
└── infrastructure/  # Serial, DB (SQLite/PG/MSSQL), HTTP API, WebSocket
```

La capa de dominio no importa nada de infraestructura. El backend de BD y el
transporte serial son totalmente intercambiables sin tocar lógica de negocio.

---

## Comandos de desarrollo

```bash
# Build
cargo build

# Tests
cargo test

# Lint
cargo clippy --all-targets -- -D warnings

# Formato
cargo fmt
```

---

## Licencia

Ver [LICENSE](LICENSE) para los términos de uso.

---

> Este software es independiente y no está afiliado a B. Braun Melsungen AG.
> El protocolo OMNI-ODI es propiedad de B. Braun Melsungen AG.

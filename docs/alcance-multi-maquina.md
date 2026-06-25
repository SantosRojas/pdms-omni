# Alcance Multi-Máquina — PDMS-Omni

## Contexto

Varias máquinas OMNI comparten una misma base de datos. Cada máquina tiene su propio `serial_number` único y cada instancia del backend corre en su propia computadora (`localhost:9001`), conectada a su propio puerto serie.

El frontend es unificado: un solo dashboard que muestra terapias de todas las máquinas.

## Decisiones de arquitectura

### BD compartida, API/WS por instancia

- **BD compartida**: todas las máquinas escriben en la misma base de datos.
- **API/WS por instancia**: cada backend expone HTTP y WebSocket en `localhost:9001` de su propia computadora.
- **Serial por instancia**: cada backend se conecta al OMNI local vía RS-232.

### Identificación de máquina actual

Cada OMNI reporta su `d_serial_number_to_odi` en cada ciclo de telemetría. El frontend lo guarda en `localStorage` la primera vez que llega:

```
1er ciclo de telemetría → updateReadings()
  → detecta d_serial_number_to_odi
  → localStorage.setItem("machine_serial", serial)
```

Esto permite que incluso después de detener el serial, el frontend sepa a qué máquina estaba conectado.

## Cambios implementados

### 1. Cierre de terapias scoped por machine_id

**`src/infrastructure/db_pool.rs`**

`close_all_open_therapies()` y `close_all_open_therapies_except_latest()` ahora reciben `machine_id: i64` y ejecutan:

```sql
UPDATE therapies SET ended_at = now, status = 'completed'
WHERE ended_at IS NULL AND machine_id = ?
```

Ya no cierran terapias de otras máquinas.

### 2. Eliminación del cierre global en serial_start

**`src/infrastructure/http_api.rs`**

El handler `POST /api/serial/start` ya no llama a `close_all_open_therapies*()`. Solo envía el comando al thread serial.

### 3. Cierre scoped en el ciclo de lecturas

**`src/main.rs`**

Cuando el ciclo resuelve un `machine_id` por primera vez (vía `get_or_create_machine`), ejecuta el cierre scoped:

```rust
if new_therapy {
    db.close_all_open_therapies(machine_id).await;
} else {
    db.close_all_open_therapies_except_latest(machine_id).await;
}
```

Se ejecuta una vez, justo después de obtener el `machine_id` en el primer ciclo.

### 4. Eliminación del StartSerialModal

**`dashboard-ts/src/presentation/components/monitoring/serial-panel.tsx`**

Al hacer clic en "Iniciar", siempre llama a `start(true)` directamente. No hay modal de "¿nueva o existente?". El cierre scoped en el backend maneja las terapias huérfanas.

### 5. Filtro de terapias por máquina en la card

**`dashboard-ts/src/presentation/components/therapies/therapy-card.tsx`**

- Si la terapia está abierta y es de la máquina actual → navega a `/therapy/:id` (live SCADA)
- Si la terapia es de otra máquina o está cerrada → navega a `/history/:id`
- El botón "Cerrar terapia" solo se muestra si la terapia es de la máquina actual

### 6. Filtro de terapias para stop modal

**`dashboard-ts/src/presentation/pages/dashboard-page.tsx`**

`hasOpenTherapies` ahora filtra por `serial_number === savedSerial`:

```tsx
const hasOpenTherapies = savedSerial
  ? openTherapies.some(t => t.serial_number === savedSerial)
  : false
```

Si no hay terapias abiertas de la máquina actual, al detener el serial no se pregunta si cerrar terapia.

### 7. Navegación al cerrar terapia desde card

**`dashboard-ts/src/presentation/pages/dashboard-page.tsx`**

Al cerrar una terapia manualmente, si el serial sigue activo, navega automáticamente a `/live`.

### 8. Guardado de serial en localStorage

**`dashboard-ts/src/application/stores/telemetry-store.ts`**

Cuando llega `d_serial_number_to_odi` en la telemetría, se guarda en `localStorage` como `machine_serial` para uso en toda la app.

### 9. Corrección del contador de fallos

**`src/infrastructure/serial_manager.rs`**

`set_failed_limit()` ahora setea `consecutive_failures = max_failures` para que el mensaje de error muestre `5/5` en vez de `0/5`.

### 10. Eliminación de StatusBar en live

**`dashboard-ts/src/presentation/pages/live-monitor-page.tsx`**

Se eliminó el componente `StatusBar` de la página de monitoreo en vivo para consistencia con therapy detail.

## Flujo completo

```
1. Usuario hace clic en "Iniciar"
   → serial-panel.tsx: start(true)
   → http_api.rs: serial_manager.start(true)
   → Thread serial corre run_reader_session(new_therapy=true)

2. 1er ciclo de lecturas
   → Se lee d_serial_number_to_odi
   → get_or_create_machine(serial) → machine_id = 42
   → close_all_open_therapies(42)  ← cierra huérfanas de máquina 42
   → Telemetría llega al frontend
   → telemetry-store.ts: guarda "machine_serial" en localStorage

3. Dashboard muestra cards
   → therapy-card.tsx: compara therapy.serial_number con localStorage
   → Si coincide → navega a /therapy/:id, muestra botón cerrar
   → Si no coincide → navega a /history/:id, no muestra botón cerrar

4. Usuario cierra terapia desde card
   → POST /api/therapies/{id}/close
   → Si serial sigue Running → navega a /live

5. Usuario hace clic en "Detener"
   → Si hay terapias abiertas de esta máquina → modal
   → Si no → stop(false) directo
```

## Estado de archivos modificados

### Backend (Rust)

| Archivo | Cambio |
|---------|--------|
| `src/infrastructure/serial_manager.rs` | `set_failed_limit()` setea `consecutive_failures` |
| `src/infrastructure/db_pool.rs` | Scoping `WHERE machine_id = ?` en close funcs |
| `src/infrastructure/http_api.rs` | Eliminado cierre global de `serial_start` |
| `src/main.rs` | Cierre scoped en bloque `get_or_create_machine` |

### Frontend (dashboard-ts)

| Archivo | Cambio |
|---------|--------|
| `src/application/stores/telemetry-store.ts` | Guarda `machine_serial` en localStorage |
| `src/presentation/components/monitoring/serial-panel.tsx` | Eliminado StartSerialModal, `start(true)` directo |
| `src/presentation/components/monitoring/stop-serial-modal.tsx` | Sin cambios |
| `src/presentation/components/therapies/therapy-card.tsx` | Filtro por máquina actual |
| `src/presentation/pages/dashboard-page.tsx` | Filtro `hasOpenTherapies` por máquina, navegación post-close |
| `src/presentation/pages/live-monitor-page.tsx` | Eliminado StatusBar, onStop navigation |

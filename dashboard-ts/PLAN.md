# dashboard-ts — Plan de Migración

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Framework | React 19 + TypeScript (strict) |
| Build | Vite 8 |
| CSS | Tailwind CSS v4 (Rust engine) |
| UI Components | shadcn/ui (Radix UI + Tailwind, compound components) |
| Routing | React Router v7 (path-based, lazy loading) |
| State | Zustand |
| Forms | React Hook Form + Zod |
| Tables | TanStack Table (virtualización, sorting, filtering) |
| Charts | Recharts |
| Icons | Lucide React |
| HTTP | Axios |

## Arquitectura DDD

```
dashboard-ts/src/
├── domain/                          # Capa de dominio — pura lógica de negocio
│   ├── entities/                    # User, Therapy, TelemetryReading, Equivalence, Patient, Signal
│   ├── value-objects/               # Theme, Density, Role, SerialStatus
│   └── repositories/               # Interfaces: AuthRepository, TherapyRepository, etc.
│
├── application/                     # Casos de uso + hooks + stores
│   ├── hooks/                       # useAuth, useTelemetry, useSerialStatus, useTherapies, useCylinderConfig
│   ├── stores/                      # Zustand: authStore, themeStore, telemetryStore, serialStore
│   └── use-cases/                   # login, close-therapy, update-equivalence
│
├── infrastructure/                  # Adaptadores
│   ├── api/                         # Axios client + interceptors, authApi, therapyApi, etc.
│   ├── ws/                          # socket-service.ts, socket-protocol.ts
│   └── storage/                     # token-storage.ts, preferences.ts
│
└── presentation/                    # UI
    ├── components/
    │   ├── ui/                      # shadcn/ui primitives
    │   ├── layout/                  # AppLayout, Sidebar, PageHeader
    │   ├── scada/                   # ⭐ StatusBar, ProcessDiagram, RadialGauge, FlowIndicator, TherapyStateMachine, AlarmPanel, EventLog, TrendChart, PatientInfoCard, PressureGrid
    │   ├── monitoring/              # SerialPanel, GeneralInfo, StatCard
    │   ├── charts/                  # AccumulatedChartBase, FlowChart, PressureChart
    │   └── shared/                  # DataTable, ErrorBoundary, FeedbackState, ConfirmModal
    ├── pages/                       # LoginPage, DashboardPage, ScadaPage, TherapyDetailPage, HistoryPage, EquivalencesPage, AdminPage, SignalsPage, ProfilePage, SettingsPage, NotFoundPage
    └── router/                      # React Router config
```

## Diseño SCADA/HMI (Vista en Vivo)

La vista principal de monitoreo en tiempo real tendrá aspecto SCADA industrial moderno:

```
┌─ StatusBar ───────────────────────────────────────────┐
│  🔴 EN VIVO | Terapia activa | 02:34:12 | B.Braun OMNI│
├─ ProcessDiagram (SVG circuito diálisis) ──────────────┤
│  Paciente ↔ Dializador con valores en vivo            │
├──────────┬──────────┬──────────┬──────────────────────┤
│Presiones │ Caudales │Acumulado │ Info + Alarmas       │
│[4 Radial]│[3 Radial]│[Tiempo]  │ [PatientInfoCard]    │
│ Gauges]  │  Gauges] │ [Vol]    │ [TherapyStateMachine]│
│          │          │          │ [AlarmPanel]         │
├──────────┴──────────┴──────────┴──────────────────────┤
│  ┌─ TrendChart Presiones ───┐ ┌─ TrendChart Caudales ┐│
│  └──────────────────────────┘ └──────────────────────┘│
│  ┌─ EventLog ─────────────────────────────────────────┐│
│  │ 14:32:01 ▶ Terapia iniciada                       ││
└───────────────────────────────────────────────────────┘
```

## Rutas

| Ruta | Página | Descripción |
|---|---|---|
| `/` | DashboardPage | Selección de terapias (home) |
| `/scada` | ScadaPage | ⭐ Vista SCADA/HMI en vivo |
| `/therapy/:id` | TherapyDetailPage | Detalle de terapia |
| `/history/:id` | HistoryPage | Historial + charts |
| `/admin` | AdminPage | CRUD usuarios |
| `/equivalences` | EquivalencesPage | Mapeo equivalencias |
| `/signals` | SignalsPage | Config señales |
| `/profile` | ProfilePage | Perfil de usuario |
| `/settings` | SettingsPage | Preferencias app |
| `/login` | LoginPage | Login (sin layout) |

## Fases

| Fase | Descripción | Archivos |
|---|---|---|
| 1 | Scaffolding: Vite + React + TS, Tailwind v4, shadcn/ui, estructura DDD | ~10 |
| 2 | Dominio: Entidades, value objects, interfaces repositorios | ~12 |
| 3 | Infraestructura: Axios client, API modules, WS service, storage | ~10 |
| 4 | Estado global: Zustand stores + hooks | ~10 |
| 5 | Auth + Layout: LoginPage, AppLayout, Sidebar, ThemeProvider | ~8 |
| 6 | SCADA/HMI: 10 componentes + ScadaPage | ~15 |
| 7 | Monitoreo: SerialPanel, GeneralInfo, StatCard | ~5 |
| 8 | Páginas CRUD: Dashboard, History, Equivalences, Admin, etc. | ~10 |
| 9 | Charts históricos: AccumulatedChartBase, FlowChart, PressureChart | ~4 |
| 10 | Cierre: ESLint, build test, integración | ~2 |

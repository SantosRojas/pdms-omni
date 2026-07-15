import { useState, useRef, useEffect, type ReactNode } from "react"
import { Card } from "@/presentation/components/ui/card"
import { RadialGauge } from "@/presentation/components/scada/radial-gauge"
import { PressureCylinder } from "@/presentation/components/scada/pressure-cylinder"
import { FlowIndicator } from "@/presentation/components/scada/flow-indicator"
import { TrendChart } from "@/presentation/components/scada/trend-chart"
import { ProcessDiagram } from "@/presentation/components/scada/process-diagram"
import { TherapyStateMachine } from "@/presentation/components/scada/therapy-state-machine"
import { PatientInfoCard } from "@/presentation/components/scada/patient-info-card"
import { AlarmPanel, type Alarm } from "@/presentation/components/scada/alarm-panel"
import { CommentsPanel } from "@/presentation/components/scada/comments-panel"

import {
  PRESSURE_GAUGES, FLOW_INDICATORS, PRESSURE_SERIES, FLOW_SERIES,
  getNum, getUnit,
} from "@/application/utils/signal-configs"
import { useCylinderConfigs } from "@/application/hooks/use-cylinder-config"
import { ToggleLeft, ToggleRight, Maximize, Minimize } from "lucide-react"
import { cn } from "@/lib/utils"
import { preferencesStorage } from "@/infrastructure/storage/preferences"
import type { ScadaViewModel } from "@/domain/view-models/scada-view-model"

interface ScadaLayoutProps {
  vm: ScadaViewModel
  alarms?: Alarm[]
  children?: ReactNode
}

export function ScadaLayout({
  vm,
  alarms = [],
  children,
}: ScadaLayoutProps) {
  const { telemetry, therapy, presentation } = vm
  const { info, pressures, flows, history } = telemetry

  const [pressureView, setPressureView] = useState<"gauge" | "cylinder">("gauge")
  const [fsChart, setFsChart] = useState<"presiones" | "caudales" | null>(null)
  const pressureRef = useRef<HTMLDivElement>(null)
  const flowRef = useRef<HTMLDivElement>(null)
  const { configs } = useCylinderConfigs()

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setFsChart(null)
    }
    document.addEventListener("fullscreenchange", onFsChange)
    return () => document.removeEventListener("fullscreenchange", onFsChange)
  }, [])

  async function toggleFs(chart: "presiones" | "caudales") {
    const el = chart === "presiones" ? pressureRef.current : flowRef.current
    if (!el) return
    if (fsChart === chart) {
      await document.exitFullscreen()
    } else {
      await el.requestFullscreen()
      setFsChart(chart)
    }
  }

  const ALL_SIGNAL_KEYS = [...PRESSURE_GAUGES.map(g => g.key), ...FLOW_INDICATORS.map(g => g.key)]

  const [visibleSignals, setVisibleSignals] = useState<Set<string>>(() => {
    const stored = preferencesStorage.getVisibleSignals()
    if (stored && stored.length > 0) return new Set(stored)
    return new Set(ALL_SIGNAL_KEYS)
  })

  function toggleSignal(key: string) {
    setVisibleSignals(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      preferencesStorage.setVisibleSignals([...next])
      return next
    })
  }

  const visiblePressures = PRESSURE_GAUGES.filter(g => visibleSignals.has(g.key))
  const visibleFlowIndicators = FLOW_INDICATORS.filter(g => visibleSignals.has(g.key))
  const visiblePressureSeries = PRESSURE_SERIES.filter(s => visibleSignals.has(s.key))
  const visibleFlowSeries = FLOW_SERIES.filter(s => visibleSignals.has(s.key))

  return (
    <div className="flex flex-col md:flex-row gap-3 w-full">
      {children}
      {/*===================PRIMERA COLUMNA========================*/}
      <div className="flex flex-col w-full md:w-72 shrink-0 gap-3">
        <PatientInfoCard info={info} therapyStart={therapy.start} therapyTime={presentation.therapyTimeDisplay} netRemovalVol={presentation.netRemovalDisplay} />
        {
          alarms.length > 0 && (
            <AlarmPanel alarms={alarms} />
          )
        }

        <Card variant="glass" dense className="p-3">
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-scada-muted">Caudales</h3>
          <div className="flex flex-col gap-3">
            {visibleFlowIndicators.map((g) => (
              <FlowIndicator
                key={g.key}
                value={getNum(flows, g.key)}
                max={g.max}
                unit={getUnit(flows, g.key) || (g.key === "c_net_rem_flow_act" ? "ml/h" : "ml/min")}
                label={g.label}
                color={g.color}
              />
            ))}
          </div>
        </Card>

        {therapy.id && <CommentsPanel therapyId={therapy.id} />}
      </div>
      {/*===================SEGUNDA COLUMNA========================*/}

      <div className="flex flex-col flex-1 gap-3">

        <div className="flex flex-col sm:flex-row gap-3">

          {/* Pression Gauges and Cylinders */}
          <Card variant="glass" dense className="flex-1 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[12px] font-semibold uppercase tracking-wider text-scada-muted">Presiones</h3>
              <button
                onClick={() => setPressureView((v) => (v === "gauge" ? "cylinder" : "gauge"))}
                className="text-scada-muted hover:text-scada-text transition-colors"
                title={pressureView === "gauge" ? "Vista cilindro" : "Vista gauge"}
              >
                {pressureView === "gauge" ? <ToggleRight className="h-5 w-5 text-primary" /> : <ToggleLeft className="h-5 w-5 text-primary" />}
              </button>
            </div>

            <div className="flex flex-wrap justify-around gap-2">
              {pressureView !== "gauge" ? (
                visiblePressures.map((g) => {
                  const cfg = configs[g.type]

                  return (
                    <RadialGauge
                      key={g.key}
                      value={getNum(pressures, g.key)}
                      min={cfg.min}
                      max={cfg.max}
                      unit="mmHg"
                      label={g.label}
                      color={g.color}
                      size="md"
                      warning={Math.abs(cfg.max) * 0.7}
                      critical={Math.abs(cfg.max) * 0.85}
                    />
                  )
                })
              ) : (
                visiblePressures.map((g) => {
                  const cfg = configs[g.type]

                  return (
                    <PressureCylinder
                      key={g.key}
                      label={g.label}
                      value={getNum(pressures, g.key)}
                      unit="mmHg"
                      config={cfg}
                      color={g.color}
                      size="md"
                    />
                  )
                })
              )}
            </div>


          </Card>
          {/* Visible signals toggle */}
          <Card variant="glass" dense className="p-3">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-scada-muted">
              Señales visibles
            </h3>
            <div className="space-y-2">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-scada-muted/60">Presiones</p>
              {PRESSURE_GAUGES.map((g) => {
                const checked = visibleSignals.has(g.key)
                return (
                  <label key={g.key} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 transition-colors hover:bg-white/5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => toggleSignal(g.key)}
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all duration-150",
                        checked
                          ? "border-scada-accent bg-scada-accent/15"
                          : "border-scada-border bg-transparent hover:border-scada-text hover:bg-white/5",
                      )}
                    >
                      {checked && (
                        <svg viewBox="0 0 12 12" className="h-3 w-3 text-scada-accent" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      )}
                    </button>
                    <span className="text-xs text-scada-text">{g.label}</span>
                  </label>
                )
              })}
              <p className="mt-2 text-[9px] font-semibold uppercase tracking-wider text-scada-muted/60">Caudales</p>
              {FLOW_INDICATORS.map((g) => {
                const checked = visibleSignals.has(g.key)
                return (
                  <label key={g.key} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 transition-colors hover:bg-white/5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => toggleSignal(g.key)}
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all duration-150",
                        checked
                          ? "border-scada-accent bg-scada-accent/15"
                          : "border-scada-border bg-transparent hover:border-scada-text hover:bg-white/5",
                      )}
                    >
                      {checked && (
                        <svg viewBox="0 0 12 12" className="h-3 w-3 text-scada-accent" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      )}
                    </button>
                    <span className="text-xs text-scada-text">{g.label}</span>
                  </label>
                )
              })}
            </div>
          </Card>

        </div>


        {
          therapy.active && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Card ref={pressureRef} variant="glass" dense className="p-3" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[12px] font-semibold uppercase tracking-wider text-scada-muted">Tendencia Presiones</h3>
                  <button onClick={() => toggleFs("presiones")} className="text-scada-muted hover:text-scada-text transition-colors">
                    {fsChart === "presiones" ? <Minimize size={14} /> : <Maximize size={14} />}
                  </button>
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>
                  <TrendChart data={history} series={visiblePressureSeries} displayNameMap={presentation.displayNameMap} height={fsChart === "presiones" ? "100%" : "180px"} />
                </div>
              </Card>
              <Card ref={flowRef} variant="glass" dense className="p-3" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[12px] font-semibold uppercase tracking-wider text-scada-muted">Tendencia Caudales</h3>
                  <button onClick={() => toggleFs("caudales")} className="text-scada-muted hover:text-scada-text transition-colors">
                    {fsChart === "caudales" ? <Minimize size={14} /> : <Maximize size={14} />}
                  </button>
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>
                  <TrendChart data={history} series={visibleFlowSeries} displayNameMap={presentation.displayNameMap} height={fsChart === "caudales" ? "100%" : "180px"} />
                </div>
              </Card>
            </div>
          )
        }

        <div className="flex flex-row gap-3 w-full">
          <TherapyStateMachine currentState={therapy.stateName} therapyActive={therapy.active} />
          <ProcessDiagram pressures={pressures} flows={flows} />
        </div>

      </div>

    </div>
  )
}

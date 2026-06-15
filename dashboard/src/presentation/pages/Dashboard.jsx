import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTelemetry } from '../../application/useTelemetry';
import { useSerialStatus } from '../../application/useSerialStatus';
import { apiService } from '../../infrastructure/api';
import { Activity, Database, ArrowLeft, History } from 'lucide-react';
import { Button } from '../components/Button';
import { EmptyState, LoadingState } from '../components/FeedbackState';
import { StatusBadge } from '../components/StatusBadge';
import { ThemeToggle } from '../components/ThemeToggle';
import { SerialPanel } from '../components/SerialPanel';
import { TherapySelector } from '../components/TherapySelector';
import { StartSerialModal } from '../components/StartSerialModal';
import { StopSerialModal } from '../components/StopSerialModal';
import { GeneralInfo } from '../components/GeneralInfo';
import { PressurePanel } from '../components/PressurePanel';

const PAGE_SIZE = 30;

export const Dashboard = ({ user, therapyId, onNavigateHistory }) => {
  const [therapies, setTherapies] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [therapyError, setTherapyError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [closingTherapyId, setClosingTherapyId] = useState(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const { serialStatus, loading: serialLoading, error: serialError, startReader, stopReader } = useSerialStatus();

  const canControlSerial = user.role === 'admin' || user.role === 'operator';

  const serialIsRunning = serialStatus.status === 'Running' || serialStatus.status === 'Initializing';
  const hasOpenTherapies = therapies.some(t => !t.ended_at && t.status !== 'completed');

  const loadPage = useCallback(async (pageNum, query) => {
    try {
      const result = await apiService.getTherapies({ page: pageNum, pageSize: PAGE_SIZE, search: query });
      setTherapyError(null);
      return result;
    } catch (e) {
      setTherapyError(e.message);
      return null;
    }
  }, []);

  // Load page 1 on mount or when search changes
  useEffect(() => {
    loadPage(1, searchQuery).then(result => {
      if (result) {
        setTherapies(result.therapies);
        setTotal(result.total);
        setPage(1);
      }
    });
  }, [searchQuery, loadPage]);

  // Auto-refresh page 1 while serial is running
  const wasRunning = useRef(serialIsRunning);
  useEffect(() => {
    const prev = wasRunning.current;
    wasRunning.current = serialIsRunning;
    if (prev === true && serialIsRunning === false) {
      // Wait a beat for backend to finish closing therapy asynchronously
      const timer = setTimeout(() => {
        loadPage(1, searchQuery).then(result => {
          if (result) {
            setTherapies(result.therapies);
            setTotal(result.total);
            setPage(1);
          }
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [serialIsRunning, searchQuery, loadPage]);

  useEffect(() => {
    if (!serialIsRunning) return;
    const interval = setInterval(async () => {
      const result = await loadPage(1, searchQuery);
      if (result) {
        setTherapies(prev => {
          if (prev.length <= PAGE_SIZE) return result.therapies;
          const merged = [...result.therapies];
          merged.push(...prev.slice(PAGE_SIZE));
          return merged;
        });
        setTotal(result.total);
        setPage(1);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [serialIsRunning, searchQuery, loadPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const result = await loadPage(nextPage, searchQuery);
    if (result) {
      setTherapies(prev => [...prev, ...result.therapies]);
      setPage(nextPage);
      setTotal(result.total);
    }
    setLoadingMore(false);
  }, [page, searchQuery, loadingMore, loadPage]);

  const hasMore = therapies.length < total;

  const activeTherapyIds = useMemo(() => {
    const latestOpenByPair = new Map();
    for (const therapy of therapies) {
      const isOpen = !therapy.ended_at && therapy.status !== 'completed';
      if (!isOpen) continue;
      const pairKey = `${therapy.patient_id_str}::${therapy.serial_number}`;
      const current = latestOpenByPair.get(pairKey);
      if (!current || String(therapy.started_at || '') > String(current.started_at || '')) {
        latestOpenByPair.set(pairKey, therapy);
      }
    }
    return new Set([...latestOpenByPair.values()].map(therapy => String(therapy.id)));
  }, [therapies]);

  const machineGroups = useMemo(() => {
    const groups = new Map();
    for (const therapy of therapies) {
      const machineKey = String(therapy.machine_id);
      if (groups.has(machineKey)) {
        groups.get(machineKey).therapies.push(therapy);
        continue;
      }
      groups.set(machineKey, {
        key: machineKey,
        machine_id: therapy.machine_id,
        serial_number: therapy.serial_number,
        software_version: therapy.software_version,
        therapies: [therapy],
      });
    }
    return [...groups.values()].sort((left, right) => {
      return String(right.therapies[0]?.started_at || '').localeCompare(String(left.therapies[0]?.started_at || '')) || (right.machine_id - left.machine_id);
    });
  }, [therapies]);

  const selectedTherapy = useMemo(
    () => therapyId === 'live' ? null : therapies.find(t => String(t.id) === String(therapyId)) || null,
    [therapies, therapyId]
  );
  const selectedTherapyIsOpen = !!selectedTherapy && !selectedTherapy.ended_at && selectedTherapy.status !== 'completed';
  const therapyIsActive = !!selectedTherapy && activeTherapyIds.has(String(selectedTherapy.id));
  const shouldConnectTelemetry = serialIsRunning || therapyIsActive;
  const { data, connected } = useTelemetry(shouldConnectTelemetry);
  const liveAvailable = connected;
  const isPreTherapy = serialIsRunning && !therapyIsActive && connected;
  const showDashboard = !!therapyId;

  // Track known therapy IDs when entering #/live mode
  const knownIdsAtLiveEntry = useRef(null);
  useEffect(() => {
    if (therapyId !== 'live') {
      knownIdsAtLiveEntry.current = null;
      return;
    }
    if (knownIdsAtLiveEntry.current === null && therapies.length > 0) {
      knownIdsAtLiveEntry.current = new Set(therapies.map(t => String(t.id)));
    }
  }, [therapyId, therapies]);

  // Track when therapies have been loaded at least once (avoid decisions on empty list)
  const therapiesLoaded = useRef(false);
  useEffect(() => {
    if (therapies.length > 0) therapiesLoaded.current = true;
  }, [therapies]);

  // Auto-select: when serial transitions to Running, go to #/live (or latest open therapy if viewing a specific one)
  const prevSerialStatus = useRef(serialStatus.status);
  const browsingRef = useRef(false);
  useEffect(() => {
    const prev = prevSerialStatus.current;
    prevSerialStatus.current = serialStatus.status;
    // Skip on initial mount: serial starts as 'Unknown' and transitions via REST fetch,
    // not a real state change. Also wait until therapies are loaded.
    if (prev === 'Unknown' || !therapiesLoaded.current) return;
    if (prev !== 'Running' && serialStatus.status === 'Running' && !therapyId) {
      browsingRef.current = false;
      const openTherapies = therapies
        .filter(t => !t.ended_at && t.status !== 'completed')
        .sort((a, b) => String(b.started_at || '').localeCompare(String(a.started_at || '')));
      const latest = openTherapies[0];
      if (latest) {
        // There's already an open therapy — stay on selection screen so user can choose
        // (StartSerialModal will offer new/continue)
      } else {
        // No open therapies — go to live monitor
        window.location.hash = '#/live';
      }
    }
  }, [serialStatus.status, therapyId, therapies]);

  // When a new open therapy appears while in #/live, navigate to it
  useEffect(() => {
    if (therapyId !== 'live' || !serialIsRunning) return;
    if (!knownIdsAtLiveEntry.current) return;

    const newOpenTherapies = therapies.filter(t =>
      !t.ended_at
      && t.status !== 'completed'
      && !knownIdsAtLiveEntry.current.has(String(t.id))
    );

    if (newOpenTherapies.length > 0) {
      const latest = newOpenTherapies.sort((a, b) =>
        String(b.started_at || '').localeCompare(String(a.started_at || ''))
      )[0];
      window.location.hash = `#/therapy/${latest.id}`;
    }
  }, [therapies, serialIsRunning, therapyId]);

  const handleBackToSelection = useCallback(() => {
    browsingRef.current = true;
    window.location.hash = '#/';
  }, []);

  const handleSelectTherapy = useCallback((id) => {
    browsingRef.current = false;
    window.location.hash = `#/therapy/${id}`;
  }, []);

  const handleCloseTherapy = useCallback(async (id) => {
    setClosingTherapyId(id);
    try {
      await apiService.closeTherapy(id);
      const result = await loadPage(1, searchQuery);
      if (result) {
        setTherapies(result.therapies);
        setTotal(result.total);
        setPage(1);
      }
    } catch (e) {
      setTherapyError(e.message);
    } finally {
      setClosingTherapyId(null);
    }
  }, [searchQuery, loadPage]);

  const handleStopClick = useCallback(() => {
    setShowStopModal(true);
  }, []);

  const handleStopConfirm = useCallback((closeTherapy) => {
    stopReader(closeTherapy);
  }, [stopReader]);

  return (
    <div className="app-container">
      {!showDashboard ? (
        <>
          <div className="glass-panel animate-slide-up" style={{ padding: '28px', display: 'grid', gap: '24px' }}>
            <div>
              <div className="header-title">
                <Activity color="var(--primary)" size={28} />
                OMNI Monitor
              </div>
              <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                Selecciona una terapia para ver su historial y, si sigue activa, la telemetría en vivo.
              </p>
            </div>

            <SerialPanel
              serialStatus={serialStatus}
              serialLoading={serialLoading}
              serialError={serialError}
              canControlSerial={canControlSerial}
              hasOpenTherapies={hasOpenTherapies}
              onStart={() => setShowStartModal(true)}
              onStartDirect={startReader}
              onStop={handleStopClick}
            />

            <TherapySelector
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              machineGroups={machineGroups}
              activeTherapyIds={activeTherapyIds}
              onSelectTherapy={handleSelectTherapy}
              onNavigateHistory={onNavigateHistory}
              therapyError={therapyError}
              hasMore={hasMore}
              loadingMore={loadingMore}
              onLoadMore={loadMore}
              onCloseTherapy={handleCloseTherapy}
              closingTherapyId={closingTherapyId}
            />
          </div>
        </>
      ) : (
        <>
          <header className="glass-panel page-header animate-slide-up">
            {/* <div className="page-header-left">
              <div className="header-title">
                <Activity color="var(--primary)" size={28} />
                OMNI Tiempo Real
              </div>
            </div> */}

            <div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {therapyId === 'live' ? 'Monitor en vivo' : isPreTherapy ? 'Pre-terapia' : 'Terapia seleccionada'}
              </div>
              <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700 }}>
                {selectedTherapy
                  ? `${selectedTherapy.patient_id_str} · Máquina ${selectedTherapy.serial_number}`
                  : therapyId === 'live'
                    ? data.info.d_serial_number_to_odi.value !== 'N/A'
                      ? `Máquina ${data.info.d_serial_number_to_odi.value}`
                      : 'Esperando datos de la máquina...'
                    : `Paciente ${data.info.g_patient_id_str.value} · Máquina ${data.info.d_serial_number_to_odi.value}`
                }
              </div>
            </div>

            <div className="page-header-right">
              {therapyId === 'live' && (
                <button className="btn btn-ghost btn-sm" onClick={handleBackToSelection}>
                  <ArrowLeft size={14} /> Volver
                </button>
              )}

              {selectedTherapy && therapyId !== 'live' && (
                <button className="btn btn-ghost btn-sm" onClick={handleBackToSelection}>
                  Cambiar terapia
                </button>
              )}

              {selectedTherapy && therapyId !== 'live' && (
                <Button variant="history" size="sm" icon={History} onClick={() => onNavigateHistory(selectedTherapy)}>
                  Historial
                </Button>
              )}

              <div className="connection-status">
                {connected && (therapyIsActive || isPreTherapy || therapyId === 'live') && data.info.g_trmt_main_state_set.value !== 'N/A' && (
                  <StatusBadge variant={therapyIsActive ? 'active' : 'warning'} style={{ marginRight: '8px' }}>
                    {data.info.g_trmt_main_state_set.value}
                  </StatusBadge>
                )}
                <div className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
                {connected && (therapyIsActive || isPreTherapy || therapyId === 'live') ? 'EN VIVO' : connected ? 'CONECTADO' : 'HISTORIAL'}
              </div>

            </div>
          </header>

          {/* <div className="glass-panel animate-fade-in" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {isPreTherapy ? 'Pre-terapia' : 'Terapia seleccionada'}
              </div>
              <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700 }}>
                {selectedTherapy
                  ? `${selectedTherapy.patient_id_str} · Máquina ${selectedTherapy.serial_number}`
                  : `Paciente ${data.info.g_patient_id_str.value} · Máquina ${data.info.d_serial_number_to_odi.value}`
                }
              </div>
            </div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>
              {isPreTherapy ? 'Monitorizando en tiempo real — esperando inicio de terapia.'
                : therapyIsActive ? 'Terapia en curso: se muestran datos en tiempo real y el historial.'
                  : selectedTherapyIsOpen ? 'Sesión abierta sin cierre: solo se muestra historial.'
                    : 'Terapia finalizada: sólo historial disponible.'}
            </div>
          </div> */}

          {therapyId === 'live' && (
            <SerialPanel
              serialStatus={serialStatus}
              serialLoading={serialLoading}
              serialError={serialError}
              canControlSerial={canControlSerial}
              hasOpenTherapies={hasOpenTherapies}
              onStart={() => setShowStartModal(true)}
              onStartDirect={startReader}
              onStop={handleStopClick}
            />
          )}

          <div className="dashboard-grid">
            <div className="side-panel">
              <GeneralInfo
                selectedTherapy={selectedTherapy}
                therapyIsActive={therapyIsActive}
                isPreTherapy={isPreTherapy}
                data={data}
              />
            </div>

            <div className="main-panel">
              {liveAvailable ? (
                <>
                  <PressurePanel data={data} />
                </>
              ) : selectedTherapyIsOpen ? (
                <EmptyState icon={Database} message="La sesión está abierta pero no se reciben datos en vivo. Esperando telemetría..." />
              ) : (
                <EmptyState icon={Database} message="La terapia seleccionada ya finalizó. Sólo se mostrará el historial desde la vista de terapia." />
              )}
            </div>
          </div>
        </>
      )}

      <StartSerialModal
        show={showStartModal}
        onClose={() => setShowStartModal(false)}
        latestTherapy={therapies.find(t => !t.ended_at && t.status !== 'completed') || therapies[0]}
        onStartReader={startReader}
      />

      <StopSerialModal
        show={showStopModal}
        onClose={() => setShowStopModal(false)}
        onStopReader={handleStopConfirm}
      />
    </div>
  );
};

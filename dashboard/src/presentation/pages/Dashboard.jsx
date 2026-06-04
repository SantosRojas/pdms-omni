import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTelemetry } from '../../application/useTelemetry';
import { useSerialStatus } from '../../application/useSerialStatus';
import { apiService } from '../../infrastructure/api';
import { Activity, Database } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { SerialPanel } from '../components/SerialPanel';
import { TherapySelector } from '../components/TherapySelector';
import { StartSerialModal } from '../components/StartSerialModal';
import { GeneralInfo } from '../components/GeneralInfo';
import { PressurePanel } from '../components/PressurePanel';
import { AccumulatedChart } from '../components/AccumulatedChart';

export const Dashboard = ({ user, onNavigateHistory }) => {
  const [therapies, setTherapies] = useState([]);
  const [selectedTherapyId, setSelectedTherapyId] = useState('');
  const [therapyError, setTherapyError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showStartModal, setShowStartModal] = useState(false);
  const { serialStatus, loading: serialLoading, error: serialError, startReader, stopReader } = useSerialStatus();

  const canControlSerial = user.role === 'admin' || user.role === 'operator';

  const therapiesSorted = useMemo(
    () => [...therapies].sort((a, b) => String(b.started_at || '').localeCompare(String(a.started_at || '')) || (b.id - a.id)),
    [therapies]
  );

  const activeTherapyIds = useMemo(() => {
    const latestOpenByPair = new Map();
    for (const therapy of therapiesSorted) {
      const isOpen = !therapy.ended_at && therapy.status !== 'completed';
      if (!isOpen) continue;
      const pairKey = `${therapy.patient_id_str}::${therapy.serial_number}`;
      const current = latestOpenByPair.get(pairKey);
      if (!current || String(therapy.started_at || '') > String(current.started_at || '')) {
        latestOpenByPair.set(pairKey, therapy);
      }
    }
    return new Set([...latestOpenByPair.values()].map(therapy => String(therapy.id)));
  }, [therapiesSorted]);

  const machineGroups = useMemo(() => {
    const groups = new Map();
    for (const therapy of therapiesSorted) {
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
  }, [therapiesSorted]);

  const filteredMachineGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return machineGroups;
    return machineGroups
      .map(machine => {
        const therapies = machine.therapies.filter(therapy => {
          const haystack = [
            machine.serial_number, machine.software_version, machine.machine_id,
            therapy.id, therapy.patient_id_str, therapy.started_at,
            therapy.ended_at || '', therapy.status,
          ].map(v => String(v ?? '').toLowerCase()).join(' ');
          return haystack.includes(query);
        });
        return therapies.length > 0 ? { ...machine, therapies } : null;
      })
      .filter(Boolean);
  }, [machineGroups, searchQuery]);

  const selectedTherapy = useMemo(
    () => therapies.find(t => String(t.id) === String(selectedTherapyId)) || null,
    [therapies, selectedTherapyId]
  );
  const selectedTherapyIsOpen = !!selectedTherapy && !selectedTherapy.ended_at && selectedTherapy.status !== 'completed';
  const therapyIsActive = !!selectedTherapy && activeTherapyIds.has(String(selectedTherapy.id));

  const { data, connected } = useTelemetry(selectedTherapy?.id, therapyIsActive);

  useEffect(() => {
    apiService.getTherapies()
      .then(list => setTherapies(list))
      .catch(e => setTherapyError(e.message));
  }, []);

  const handleBackToSelection = useCallback(() => {
    setSelectedTherapyId('');
  }, []);

  return (
    <div className="app-container">
      {!selectedTherapy ? (
        <>
          <div className="glass-panel animate-slide-up" style={{ padding: '28px', display: 'grid', gap: '24px' }}>
            <div>
              <div className="header-title">
                <Activity color="var(--primary)" size={28} />
                OMNI Tiempo Real
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
              hasTherapies={therapies.length > 0}
              onStart={() => setShowStartModal(true)}
              onStartDirect={startReader}
              onStop={stopReader}
            />

            <TherapySelector
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              filteredMachineGroups={filteredMachineGroups}
              activeTherapyIds={activeTherapyIds}
              onSelectTherapy={setSelectedTherapyId}
              onNavigateHistory={onNavigateHistory}
              therapyError={therapyError}
            />
          </div>
        </>
      ) : (
        <>
          <header className="glass-panel page-header animate-slide-up">
            <div className="page-header-left">
              <div className="header-title">
                <Activity color="var(--primary)" size={28} />
                OMNI Tiempo Real
              </div>
            </div>

            <div className="page-header-right">
              <button className="btn btn-ghost btn-sm" onClick={handleBackToSelection}>
                Cambiar terapia
              </button>

              <button
                className="btn btn-sm"
                style={{
                  background: 'var(--btn-nav-history)',
                  border: '1px solid rgba(59,130,246,0.2)',
                  color: 'var(--btn-nav-history-text)',
                }}
                onClick={() => onNavigateHistory(selectedTherapy)}
              >
                <Database size={14} /> Historial
              </button>

              <div className="connection-status">
                <div className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
                {therapyIsActive && connected ? 'EN VIVO' : 'HISTORIAL'}
              </div>

            </div>
          </header>

          <div className="glass-panel animate-fade-in" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Terapia seleccionada
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700 }}>
                {selectedTherapy.patient_id_str} · Máquina {selectedTherapy.serial_number}
              </div>
            </div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
              {therapyIsActive ? 'Terapia en curso: se muestran datos en tiempo real y el historial.'
                : selectedTherapyIsOpen ? 'Sesión abierta sin cierre: solo se muestra historial.'
                  : 'Terapia finalizada: sólo historial disponible.'}
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="side-panel">
              <GeneralInfo
                selectedTherapy={selectedTherapy}
                therapyIsActive={therapyIsActive}
                data={data}
              />
            </div>

            <div className="main-panel">
              {therapyIsActive ? (
                <>
                  <PressurePanel data={data} />
                  <AccumulatedChart therapyId={selectedTherapyId} isActive={therapyIsActive} />
                </>
              ) : (
                <div className="glass-panel empty-state" style={{ padding: '48px' }}>
                  <Database size={32} style={{ opacity: 0.3 }} />
                  <span>La terapia seleccionada ya finalizó. Sólo se mostrará el historial desde la vista de terapia.</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <StartSerialModal
        show={showStartModal}
        onClose={() => setShowStartModal(false)}
        latestTherapy={therapiesSorted[0]}
        onStartReader={startReader}
      />
    </div>
  );
};

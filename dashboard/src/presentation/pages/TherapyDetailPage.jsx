import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTelemetry } from '../../application/useTelemetry';
import { useSerialStatus } from '../../application/useSerialStatus';
import { apiService } from '../../infrastructure/api';
import { Database } from 'lucide-react';
import { MonitoringHeader } from '../components/MonitoringHeader';
import { GeneralInfo } from '../components/GeneralInfo';
import { PressurePanel } from '../components/PressurePanel';
import { EmptyState } from '../components/FeedbackState';

export const TherapyDetailPage = ({ therapyId, onNavigateHistory }) => {
  const { serialStatus } = useSerialStatus();
  const [therapies, setTherapies] = useState([]);
  const [loading, setLoading] = useState(true);

  const serialIsRunning = serialStatus.status === 'Running' || serialStatus.status === 'Initializing';

  useEffect(() => {
    const fetchTherapies = async () => {
      try {
        const result = await apiService.getTherapies({ page: 1, pageSize: 50 });
        setTherapies(result.therapies || []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    fetchTherapies();
  }, []);

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

  const selectedTherapy = useMemo(
    () => therapies.find(t => String(t.id) === String(therapyId)) || null,
    [therapies, therapyId]
  );

  const selectedTherapyIsOpen = !!selectedTherapy && !selectedTherapy.ended_at && selectedTherapy.status !== 'completed';
  const therapyIsActive = !!selectedTherapy && activeTherapyIds.has(String(selectedTherapy.id));
  const shouldConnectTelemetry = serialIsRunning || therapyIsActive;
  const { data, connected } = useTelemetry(shouldConnectTelemetry);
  const liveAvailable = connected && (therapyIsActive || serialIsRunning);
  const isPreTherapy = serialIsRunning && !therapyIsActive && connected;

  const handleBack = useCallback(() => {
    window.location.hash = '#/';
  }, []);

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading-screen" style={{ minHeight: '200px' }}>
          <div className="spinner spinner-lg" />
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-input)' }}>Cargando terapia...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <MonitoringHeader
        mode="therapy"
        selectedTherapy={selectedTherapy}
        therapyIsActive={therapyIsActive}
        isPreTherapy={isPreTherapy}
        connected={connected}
        data={data}
        onBack={handleBack}
        onNavigateHistory={onNavigateHistory}
      />

      <div className="dashboard-grid">
        <GeneralInfo
          selectedTherapy={selectedTherapy}
          therapyIsActive={therapyIsActive}
          isPreTherapy={isPreTherapy}
          data={data}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {liveAvailable ? (
            <PressurePanel data={data} />
          ) : selectedTherapyIsOpen ? (
            <EmptyState icon={Database} message="La sesión está abierta pero no se reciben datos en vivo. Esperando telemetría..." />
          ) : (
            <EmptyState icon={Database} message="La terapia seleccionada ya finalizó. Sólo se mostrará el historial desde la vista de terapia." />
          )}
        </div>
      </div>
    </div>
  );
};

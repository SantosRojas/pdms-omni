import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTelemetry } from '../../application/useTelemetry';
import { useSerialStatus } from '../../application/useSerialStatus';
import { apiService } from '../../infrastructure/api';
import { Database } from 'lucide-react';
import { MonitoringHeader } from '../components/MonitoringHeader';
import { SerialPanel } from '../components/SerialPanel';
import { GeneralInfo } from '../components/GeneralInfo';
import { PressurePanel } from '../components/PressurePanel';
import { EmptyState } from '../components/FeedbackState';
import { StopSerialModal } from '../components/StopSerialModal';

export const LiveMonitorPage = ({ user }) => {
  const { serialStatus, loading: serialLoading, error: serialError, startReader, stopReader } = useSerialStatus();
  const { data, connected } = useTelemetry(true);
  const [showStopModal, setShowStopModal] = useState(false);
  const [therapies, setTherapies] = useState([]);

  const canControlSerial = user.role === 'admin' || user.role === 'operator';
  const serialIsRunning = serialStatus.status === 'Running' || serialStatus.status === 'Initializing';

  const knownIdsAtEntry = useRef(null);

  useEffect(() => {
    if (therapies.length > 0 && knownIdsAtEntry.current === null) {
      knownIdsAtEntry.current = new Set(therapies.map(t => String(t.id)));
    }
  }, [therapies]);

  useEffect(() => {
    return () => { knownIdsAtEntry.current = null; };
  }, []);

  const fetchTherapies = useCallback(async () => {
    try {
      const result = await apiService.getTherapies({ page: 1, pageSize: 50 });
      return result.therapies || [];
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    fetchTherapies().then(setTherapies);
  }, [fetchTherapies]);

  useEffect(() => {
    if (!serialIsRunning) return;
    const interval = setInterval(() => fetchTherapies().then(setTherapies), 5000);
    return () => clearInterval(interval);
  }, [serialIsRunning, fetchTherapies]);

  useEffect(() => {
    if (!serialIsRunning || knownIdsAtEntry.current === null) return;
    const newOpen = therapies.filter(t =>
      !t.ended_at
      && t.status !== 'completed'
      && !knownIdsAtEntry.current.has(String(t.id))
    );
    if (newOpen.length > 0) {
      const latest = newOpen.sort((a, b) =>
        String(b.started_at || '').localeCompare(String(a.started_at || ''))
      )[0];
      window.location.hash = `#/therapy/${latest.id}`;
    }
  }, [therapies, serialIsRunning]);

  const handleStopClick = useCallback(() => {
    setShowStopModal(true);
  }, []);

  const handleStopConfirm = useCallback((closeTherapy) => {
    stopReader(closeTherapy);
  }, [stopReader]);

  const handleBack = useCallback(() => {
    window.location.hash = '#/';
  }, []);

  return (
    <div className="app-container">
      <MonitoringHeader
        mode="live"
        connected={connected}
        data={data}
        onBack={handleBack}
      />

      <SerialPanel
        serialStatus={serialStatus}
        serialLoading={serialLoading}
        serialError={serialError}
        canControlSerial={canControlSerial}
        hasOpenTherapies={false}
        onStart={() => {}}
        onStartDirect={startReader}
        onStop={handleStopClick}
      />

      <div className="dashboard-grid">
        <GeneralInfo
          selectedTherapy={null}
          therapyIsActive={false}
          isPreTherapy={serialIsRunning && connected}
          data={data}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {connected ? (
            <PressurePanel data={data} />
          ) : (
            <EmptyState icon={Database} message="Esperando conexión con el dispositivo..." />
          )}
        </div>
      </div>

      <StopSerialModal
        show={showStopModal}
        onClose={() => setShowStopModal(false)}
        onStopReader={handleStopConfirm}
      />
    </div>
  );
};

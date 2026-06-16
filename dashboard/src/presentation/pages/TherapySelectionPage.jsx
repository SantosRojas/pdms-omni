import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSerialStatus } from '../../application/useSerialStatus';
import { apiService } from '../../infrastructure/api';
import { Activity } from 'lucide-react';
import { SerialPanel } from '../components/SerialPanel';
import { TherapySelector } from '../components/TherapySelector';
import { StartSerialModal } from '../components/StartSerialModal';
import { StopSerialModal } from '../components/StopSerialModal';

const PAGE_SIZE = 30;

export const TherapySelectionPage = ({ user, onNavigateHistory }) => {
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

  useEffect(() => {
    loadPage(1, searchQuery).then(result => {
      if (result) {
        setTherapies(result.therapies);
        setTotal(result.total);
        setPage(1);
      }
    });
  }, [searchQuery, loadPage]);

  const wasRunning = useRef(serialIsRunning);
  useEffect(() => {
    const prev = wasRunning.current;
    wasRunning.current = serialIsRunning;
    if (prev === true && serialIsRunning === false) {
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

  const therapiesLoaded = useRef(false);
  useEffect(() => {
    if (therapies.length > 0) therapiesLoaded.current = true;
  }, [therapies]);

  const prevSerialStatus = useRef(serialStatus.status);
  useEffect(() => {
    const prev = prevSerialStatus.current;
    prevSerialStatus.current = serialStatus.status;
    if (prev === 'Unknown' || !therapiesLoaded.current) return;
    if (prev !== 'Running' && serialStatus.status === 'Running') {
      const openTherapies = therapies
        .filter(t => !t.ended_at && t.status !== 'completed')
        .sort((a, b) => String(b.started_at || '').localeCompare(String(a.started_at || '')));
      if (!openTherapies[0]) {
        window.location.hash = '#/live';
      }
    }
  }, [serialStatus.status, therapies]);

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

  const handleSelectTherapy = useCallback((id) => {
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

import { useState, useEffect, useCallback } from 'react';
import { socketService } from '../infrastructure/socket';
import { apiService } from '../infrastructure/api';

/**
 * Hook that tracks the serial reader status.
 * - Polls the REST endpoint on mount to get the initial state.
 * - Listens for real-time `serial_status` WebSocket events.
 * - Exposes start / stop actions and a loading flag.
 */
export const useSerialStatus = () => {
  const [serialStatus, setSerialStatus] = useState({
    status: 'Unknown',
    consecutive_failures: 0,
    max_failures: 0,
    data_warnings: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch initial status from REST
  useEffect(() => {
    apiService.getSerialStatus()
      .then(s => setSerialStatus(s))
      .catch(e => console.warn('[Serial] Could not fetch initial status:', e.message));
  }, []);

  // Subscribe to WS serial_status events (always, regardless of therapy)
  useEffect(() => {
    socketService.connect('serialStatus');
    socketService.onSerialStatus((payload) => {
      setSerialStatus({
        status: payload.status,
        consecutive_failures: payload.consecutive_failures,
        max_failures: payload.max_failures,
        data_warnings: payload.data_warnings || 0,
      });
    });

    return () => {
      socketService.offSerialStatus();
      socketService.disconnect('serialStatus');
    };
  }, []);

  const startReader = useCallback(async (newTherapy = false) => {
    setLoading(true);
    setError(null);
    try {
      await apiService.startSerial(newTherapy);
      setSerialStatus(prev => ({ ...prev, status: 'Initializing', consecutive_failures: 0, data_warnings: 0 }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const stopReader = useCallback(async (closeTherapy = true) => {
    setLoading(true);
    setError(null);
    try {
      await apiService.stopSerial(closeTherapy);
      setSerialStatus(prev => ({ ...prev, status: 'Stopped' }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { serialStatus, loading, error, startReader, stopReader };
};

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X, ChevronRight, Loader } from 'lucide-react';
import { toLocalDatetime } from '../../infrastructure/time';

function useDebouncedValue(value, delay = 200) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const TherapyCard = ({ therapy, active, onSelect, onNavigateHistory }) => {
  const isOpen = !therapy.ended_at && therapy.status !== 'completed';
  const badgeLabel = active ? 'Activa' : isOpen ? 'Sin cerrar' : 'Finalizada';

  return (
    <button
      className="detail-card animate-fade-in"
      onClick={() => active ? onSelect(String(therapy.id)) : onNavigateHistory(therapy)}
      style={{ textAlign: 'left', display: 'grid', gap: '10px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '10px' }}>
        <div>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>
            Terapia #{therapy.id}
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: '4px' }}>
            {therapy.patient_id_str}
          </div>
        </div>
        <span className={`badge ${active ? 'badge-active' : isOpen ? 'badge-open' : 'badge-closed'}`}>
          {badgeLabel}
        </span>
      </div>
      <div style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
        Inició: {toLocalDatetime(therapy.started_at)}
      </div>
      <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
        {therapy.ended_at ? toLocalDatetime(therapy.ended_at) : 'Aún sin cierre'}
      </div>
    </button>
  );
};

const MachineGroup = ({ machine, activeTherapyIds, onSelectTherapy, onNavigateHistory }) => {
  const activeTherapies = machine.therapies.filter(t => activeTherapyIds.has(String(t.id)));
  const openTherapies = machine.therapies.filter(t => !t.ended_at && t.status !== 'completed');

  return (
    <details key={machine.key} className="machine-details">
      <summary>
        <div style={{ display: 'grid', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '1rem' }}>Máquina {machine.serial_number}</strong>
            <span className={`badge ${activeTherapies.length ? 'badge-active' : openTherapies.length ? 'badge-open' : 'badge-closed'}`}>
              {activeTherapies.length ? `${activeTherapies.length} activa${activeTherapies.length > 1 ? 's' : ''}`
                : openTherapies.length ? `${openTherapies.length} sin cerrar`
                  : 'Sin actividad'}
            </span>
          </div>
          <span style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
            SW {machine.software_version} · {machine.therapies.length} terapia{machine.therapies.length > 1 ? 's' : ''}
          </span>
        </div>
        <ChevronRight size={16} style={{ color: 'var(--text-tertiary)', transition: 'transform 0.18s' }} />
      </summary>

      <div style={{ padding: '20px', display: 'grid', gap: '12px' }}>
        <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Selecciona una terapia de esta máquina:</div>
        <div className="card-grid">
          {machine.therapies.map(therapy => {
            const active = activeTherapyIds.has(String(therapy.id));
            return (
              <TherapyCard
                key={therapy.id}
                therapy={therapy}
                active={active}
                onSelect={onSelectTherapy}
                onNavigateHistory={onNavigateHistory}
              />
            );
          })}
        </div>
      </div>
    </details>
  );
};

export const TherapySelector = ({
  searchQuery,
  onSearchChange,
  machineGroups,
  activeTherapyIds,
  onSelectTherapy,
  onNavigateHistory,
  therapyError,
  hasMore,
  loadingMore,
  onLoadMore,
}) => {
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const debouncedQuery = useDebouncedValue(localQuery, 200);

  useEffect(() => {
    if (debouncedQuery !== searchQuery) {
      onSearchChange(debouncedQuery);
    }
  }, [debouncedQuery, searchQuery, onSearchChange]);

  const handleClear = useCallback(() => {
    setLocalQuery('');
  }, []);

  return (
    <>
      {therapyError && (
        <div className="message-box message-error">
          No se pudieron cargar las terapias: {therapyError}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search-container">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            value={localQuery}
            onChange={e => setLocalQuery(e.target.value)}
            placeholder="Buscar por máquina, paciente, terapia o fecha"
            style={{ paddingLeft: '38px' }}
          />
          {localQuery && (
            <button type="button" onClick={handleClear} className="search-clear" aria-label="Limpiar">
              <X size={16} />
            </button>
          )}
        </div>
        <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
          {machineGroups.length} máquina{machineGroups.length === 1 ? '' : 's'}
        </div>
      </div>

      <div style={{ display: 'grid', gap: '14px' }}>
        {machineGroups.length > 0 ? machineGroups.map(machine => (
          <MachineGroup
            key={machine.key}
            machine={machine}
            activeTherapyIds={activeTherapyIds}
            onSelectTherapy={onSelectTherapy}
            onNavigateHistory={onNavigateHistory}
          />
        )) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Search size={20} />
            </div>
            <span>No se encontraron máquinas ni terapias para esa búsqueda.</span>
          </div>
        )}
      </div>

      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="btn btn-ghost"
            style={{ padding: '10px 32px', fontSize: '0.85rem' }}
          >
            {loadingMore ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null}
            {loadingMore ? 'Cargando...' : 'Cargar más terapias'}
          </button>
        </div>
      )}
    </>
  );
};

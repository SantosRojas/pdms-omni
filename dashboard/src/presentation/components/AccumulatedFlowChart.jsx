import React, { memo } from 'react';
import { Waves } from 'lucide-react';
import { AccumulatedChartBase } from './AccumulatedChartBase';

export const AccumulatedFlowChart = memo(({ therapyId, isActive }) => (
  <AccumulatedChartBase
    title="Flujos Acumulados"
    icon={Waves}
    therapyId={therapyId}
    isActive={isActive}
    emptyMessage="No hay datos históricos de flujos para esta terapia."
    lines={[
      { key: 'c_pump_bs_bl_flow_act', name: 'Flujo Sanguíneo', color: 'var(--art-color)' },
      { key: 'c_pump_fs_mid_flow_act', name: 'Flujo Diálisis', color: 'var(--tmp-color)' },
      { key: 'c_net_rem_flow_act', name: 'Remoción Neta', color: 'var(--fil-color)' },
      { key: 'c_acc_net_rem_vol_act', name: 'Rem. Neta Acum.', color: '#22d3ee' },
    ]}
  />
));

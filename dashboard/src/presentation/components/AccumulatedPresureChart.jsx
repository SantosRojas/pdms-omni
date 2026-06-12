import React, { memo } from 'react';
import { Database } from 'lucide-react';
import { AccumulatedChartBase } from './AccumulatedChartBase';

export const AccumulatedPresureChart = memo(({ therapyId, isActive }) => (
  <AccumulatedChartBase
    title="Presiones Acumuladas"
    icon={Database}
    therapyId={therapyId}
    isActive={isActive}
    emptyMessage="No hay datos históricos suficientes para esta terapia."
    lines={[
      { key: 'c_press_ap_act', name: 'Arterial', color: 'var(--art-color)' },
      { key: 'c_press_vp_act', name: 'Venoso', color: 'var(--ven-color)' },
      { key: 'c_press_tmp_act', name: 'TMP', color: 'var(--tmp-color)' },
      { key: 'c_press_fp_act', name: 'Filtro', color: 'var(--fil-color)' },
    ]}
  />
));

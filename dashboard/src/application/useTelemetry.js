import { useState, useEffect } from 'react';
import { socketService } from '../infrastructure/socket';

export const useTelemetry = (therapyId, isActive) => {
  const [data, setData] = useState({
    pressures: {
      c_press_ap_act: { value: 0, unit: 'mmHg' },
      c_press_vp_act: { value: 0, unit: 'mmHg' },
      c_press_fp_act: { value: 0, unit: 'mmHg' },
      c_press_tmp_act: { value: 0, unit: 'mmHg' },
    },
    flows: {
      c_pump_bs_bl_flow_act: { value: 0, unit: 'ml/min' },
      c_net_rem_flow_act: { value: 0, unit: 'ml/h' },
      c_pump_fs_mid_flow_act: { value: 0, unit: 'ml/min' },
    },
    info: {
      g_patient_data_weight_set: { value: 0, unit: 'kg' },
      g_therapy_mode_set: { value: 'N/A' },
      g_anticoag_mode_set: { value: 'N/A' },
      d_kit_type_str: { value: 'N/A' },
      c_acc_therapy_time_act: { value: 0, unit: 'min' },
      g_patient_id_str: { value: 'N/A' },
      d_renal_dose_act: { value: 0, unit: 'ml/kg/h' },
      c_acc_net_rem_vol_act: { value: 0, unit: 'ml' },
      g_trmt_main_state_set: { value: 'N/A' },
      g_trmt_sub_state_set: { value: 'N/A' }
    },
    history: []
  });

  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!therapyId || !isActive) {
      socketService.offTelemetry();
      socketService.disconnect();
      setConnected(false);
      return;
    }

    socketService.connect();

    socketService.onConnect(() => setConnected(true));
    socketService.onDisconnect(() => setConnected(false));

    socketService.onTelemetry((readings) => {
      // readings is an array of TelemetryReading objects:
      // [{ internal_name, physical_value, unit, display_value }]
      setData(prev => {
        const next = {
          pressures: { ...prev.pressures },
          flows: { ...prev.flows },
          info: { ...prev.info },
          history: [...prev.history],
        };

        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

        const newPoint = {
          time: timeStr,
          c_press_ap_act: prev.pressures.c_press_ap_act.value,
          c_press_vp_act: prev.pressures.c_press_vp_act.value,
          c_press_fp_act: prev.pressures.c_press_fp_act.value,
          c_press_tmp_act: prev.pressures.c_press_tmp_act.value,
        };

        readings.forEach(item => {
          const name = item.internal_name;
          const val = item.display_value !== null && item.display_value !== undefined
            ? item.display_value
            : item.physical_value;

          if (next.pressures[name] !== undefined) {
            next.pressures[name] = { value: val, unit: item.unit };
            newPoint[name] = val;
          } else if (next.flows[name] !== undefined) {
            next.flows[name] = { value: val, unit: item.unit };
          } else if (next.info[name] !== undefined) {
            next.info[name] = { value: val, unit: item.unit || '' };
          }
        });

        next.history.push(newPoint);
        if (next.history.length > 50) next.history.shift();

        return next;
      });
    });

    return () => {
      socketService.offTelemetry();
      socketService.disconnect();
    };
  }, [therapyId, isActive]);

  return { data, connected };
};

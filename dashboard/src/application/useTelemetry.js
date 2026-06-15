import { useState, useEffect, useRef, useCallback } from 'react';
import { socketService } from '../infrastructure/socket';

const MAX_HISTORY = 50;
const INITIAL_DATA = {
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
    d_serial_number_to_odi: { value: 'N/A' },
    d_renal_dose_act: { value: 0, unit: 'ml/kg/h' },
    c_acc_net_rem_vol_act: { value: 0, unit: 'ml' },
    g_trmt_main_state_set: { value: 'N/A' },
    g_trmt_sub_state_set: { value: 'N/A' }
  },
  history: [],
};

function buildSnapshot(readings, prev) {
  const pressures = { ...prev.pressures };
  const flows = { ...prev.flows };
  const info = { ...prev.info };

  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

  const newPoint = {
    time: timeStr,
    c_press_ap_act: prev.pressures.c_press_ap_act.value,
    c_press_vp_act: prev.pressures.c_press_vp_act.value,
    c_press_fp_act: prev.pressures.c_press_fp_act.value,
    c_press_tmp_act: prev.pressures.c_press_tmp_act.value,
    c_pump_bs_bl_flow_act: prev.flows.c_pump_bs_bl_flow_act.value,
    c_pump_fs_mid_flow_act: prev.flows.c_pump_fs_mid_flow_act.value,
    c_net_rem_flow_act: prev.flows.c_net_rem_flow_act.value,
  };

  readings.forEach(item => {
    const val = item.display_value ?? item.physical_value;
    if (pressures[item.internal_name] !== undefined) {
      pressures[item.internal_name] = { value: val, unit: item.unit };
      newPoint[item.internal_name] = val;
    } else if (flows[item.internal_name] !== undefined) {
      flows[item.internal_name] = { value: val, unit: item.unit };
      newPoint[item.internal_name] = val;
    } else if (info[item.internal_name] !== undefined) {
      info[item.internal_name] = { value: val, unit: item.unit || '' };
    }
  });

  const history = prev.history.length < MAX_HISTORY
    ? [...prev.history, newPoint]
    : [...prev.history.slice(1), newPoint];

  return { pressures, flows, info, history };
}

export const useTelemetry = (connect) => {
  const [data, setData] = useState(INITIAL_DATA);
  const [connected, setConnected] = useState(false);
  const liveRef = useRef(INITIAL_DATA);
  const rafRef = useRef(null);

  const flushToState = useCallback(() => {
    rafRef.current = null;
    setData({ ...liveRef.current, history: [...liveRef.current.history] });
  }, []);

  useEffect(() => {
    if (!connect) {
      socketService.offTelemetry();
      socketService.disconnect('telemetry');
      liveRef.current = INITIAL_DATA;
      const timer = setTimeout(() => {
        setConnected(false);
        setData(INITIAL_DATA);
      }, 0);
      return () => clearTimeout(timer);
    }

    socketService.onConnect(() => setConnected(true));
    socketService.onDisconnect(() => setConnected(false));

    socketService.onTelemetry((readings) => {
      liveRef.current = buildSnapshot(readings, liveRef.current);
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(flushToState);
      }
    });

    socketService.connect('telemetry');

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      socketService.offTelemetry();
      socketService.disconnect('telemetry');
    };
  }, [connect, flushToState]);

  return { data, connected };
};

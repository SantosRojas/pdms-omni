/**
 * PDMS Omni Dashboard - Real-time Visualization Logic
 */

const WS_URL = 'ws://localhost:9001/ws';
const sensorGrid = document.getElementById('sensor-grid');
const wsStatus = document.getElementById('ws-status');
const pulseIndicator = document.getElementById('status-pulse');
const cycleCount = document.getElementById('cycle-count');
const latencyEl = document.getElementById('latency');

// Map internal names to user-friendly titles and icons
const SENSOR_META = {
    'g_patient_id_str': { title: 'ID Paciente', icon: 'user' },
    'g_therapy_mode_set': { title: 'Modo Terapia', icon: 'settings' },
    'g_anticoag_mode_set': { title: 'Anticoagulante', icon: 'droplets' },
    'd_kit_type_str': { title: 'Tipo de Kit', icon: 'package' },
    'c_pump_bs_bl_flow_act': { title: 'Flujo Sangre', icon: 'refresh-ccw' },
    'c_acc_therapy_time_act': { title: 'Tiempo Terapia', icon: 'clock' },
    'c_net_rem_flow_act': { title: 'Flujo Red (UF)', icon: 'filter' },
    'c_pump_fs_mid_flow_act': { title: 'Flujo Bomba FS', icon: 'zap' },
    'c_press_ap_act': { title: 'Presión Arterial', icon: 'navigation' },
    'c_press_fp_act': { title: 'Presión Filtro', icon: 'layers' },
    'c_press_vp_act': { title: 'Presión Venosa', icon: 'arrow-down-circle' },
    'c_press_tmp_act': { title: 'Presión TMP', icon: 'shield' },
    'g_patient_data_weight_set': { title: 'Peso Paciente', icon: 'scale' }
};

let lastSyncTime = Date.now();
const sensorStates = new Map();
const historyData = []; // Store last 50 cycles
const MAX_HISTORY = 50;

// Navigation Logic
const views = {
    monitor: document.getElementById('view-monitor'),
    history: document.getElementById('view-history'),
    settings: document.getElementById('view-settings'),
    charts: document.getElementById('view-charts')
};

const navButtons = {
    monitor: document.getElementById('btn-monitor'),
    history: document.getElementById('btn-history'),
    settings: document.getElementById('btn-settings'),
    charts: document.getElementById('btn-charts')
};

function switchView(viewName) {
    Object.keys(views).forEach(name => {
        views[name].classList.toggle('active', name === viewName);
        navButtons[name].classList.toggle('active', name === viewName);
    });
    
    if (viewName === 'history') {
        renderHistory();
    }
}

navButtons.monitor.addEventListener('click', () => switchView('monitor'));
navButtons.history.addEventListener('click', () => switchView('history'));
navButtons.settings.addEventListener('click', () => switchView('settings'));
navButtons.charts.addEventListener('click', () => switchView('charts'));

// Chart.js Setup
let mainChart = null;
function initChart() {
    const ctx = document.getElementById('main-trend-chart').getContext('2d');
    mainChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'P. Arterial', borderColor: '#00d4ff', data: [], tension: 0.4, borderWidth: 2, pointRadius: 0 },
                { label: 'P. Venosa', borderColor: '#ff4d4d', data: [], tension: 0.4, borderWidth: 2, pointRadius: 0 },
                { label: 'P. Filtro', borderColor: '#ffb400', data: [], tension: 0.4, borderWidth: 2, pointRadius: 0 },
                { label: 'P. TMP', borderColor: '#00ffca', data: [], tension: 0.4, borderWidth: 2, pointRadius: 0 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a0a0b0' } },
                x: { grid: { display: false }, ticks: { color: '#a0a0b0' } }
            },
            plugins: {
                legend: { labels: { color: '#ffffff', font: { size: 12 } } }
            }
        }
    });
}

function updateChart(payload) {
    if (!mainChart) return;

    // Max data points on chart
    if (mainChart.data.labels.length > 30) {
        mainChart.data.labels.shift();
        mainChart.data.datasets.forEach(ds => ds.data.shift());
    }

    mainChart.data.labels.push(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    
    // Map pressures
    const readings = payload.readings;
    const findVal = (name) => readings.find(r => r.internal_name === name)?.physical_value || 0;

    mainChart.data.datasets[0].data.push(findVal('c_press_ap_act'));
    mainChart.data.datasets[1].data.push(findVal('c_press_vp_act'));
    mainChart.data.datasets[2].data.push(findVal('c_press_fp_act'));
    mainChart.data.datasets[3].data.push(findVal('c_press_tmp_act'));

    mainChart.update('none'); // Update without animation for performance
}

function connect() {
    console.log('[WS] Connecting to:', WS_URL);
    const socket = new WebSocket(WS_URL);

    socket.onopen = () => {
        console.log('[WS] Connected');
        wsStatus.innerText = 'Conectado';
        wsStatus.style.color = '#00ffca';
        pulseIndicator.classList.add('active');
    };

    socket.onclose = () => {
        console.log('[WS] Disconnected, retrying in 2s...');
        wsStatus.innerText = 'Desconectado';
        wsStatus.style.color = '#ff4d4d';
        pulseIndicator.classList.remove('active');
        setTimeout(connect, 2000);
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'telemetry') {
                updateDashboard(data);
                updateChart(data);
                addToHistory(data);
            }
        } catch (e) {
            console.error('[WS] Parse error:', e);
        }
    };
}

function addToHistory(payload) {
    // Keep only the most recent cycles
    historyData.unshift(payload);
    if (historyData.length > MAX_HISTORY) {
        historyData.pop();
    }
    
    // Auto-update table if currently viewing history
    if (views.history.classList.contains('active')) {
        renderHistory();
    }
}

function renderHistory() {
    const tbody = document.getElementById('history-body');
    tbody.innerHTML = '';

    historyData.forEach(cycleData => {
        cycleData.readings.forEach(reading => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="color: var(--text-dim)">#${cycleData.cycle}</td>
                <td>0x${reading.handle.toString(16).toUpperCase()}</td>
                <td style="font-family: monospace; font-size: 12px">${reading.internal_name}</td>
                <td style="font-weight: 600">${reading.physical_value.toFixed(2)}</td>
                <td style="color: var(--accent)">${reading.unit || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    });
}

function updateDashboard(payload) {
    const readings = payload.readings;
    const cycle = payload.cycle;
    
    // Update stats
    cycleCount.innerText = cycle;
    const now = Date.now();
    latencyEl.innerText = `${Math.max(0, now - lastSyncTime)} ms`;
    lastSyncTime = now;

    // Remove loading state if first cycle
    if (document.querySelector('.loading-state')) {
        sensorGrid.innerHTML = '';
    }

    readings.forEach(reading => {
        let card = document.getElementById(`card-${reading.handle}`);
        const meta = SENSOR_META[reading.internal_name.toLowerCase()] || { 
            title: reading.internal_name, 
            icon: 'database' 
        };

        const prevValue = sensorStates.get(reading.handle) || reading.physical_value;
        const trend = reading.physical_value > prevValue ? 'up' : (reading.physical_value < prevValue ? 'down' : 'neutral');
        sensorStates.set(reading.handle, reading.physical_value);

        if (!card) {
            card = document.createElement('div');
            card.id = `card-${reading.handle}`;
            card.className = 'sensor-card';
            sensorGrid.appendChild(card);
        }

        const valueFormatted = typeof reading.physical_value === 'number' 
            ? reading.physical_value.toFixed(2) 
            : reading.physical_value;

        card.innerHTML = `
            <div class="sensor-header">
                <div class="sensor-icon">
                    <i data-lucide="${meta.icon}"></i>
                </div>
                <div class="sensor-info">
                    <h3>${meta.title}</h3>
                    <p>ID: 0x${reading.handle.toString(16).toUpperCase()}</p>
                </div>
            </div>
            <div class="sensor-value-area">
                <span class="sensor-value" style="color: ${reading.physical_value > 0 ? 'var(--text-main)' : 'var(--text-dim)'}">${valueFormatted}</span>
                <span class="sensor-unit">${reading.unit || ''}</span>
            </div>
            <div class="sensor-trend trend-${trend}">
                ${trend === 'up' ? '▲ Subiendo' : (trend === 'down' ? '▼ Bajando' : '● Estable')}
            </div>
        `;

        // Update icons
        lucide.createIcons();
    });
}

// Start time display
setInterval(() => {
    const d = new Date();
    document.getElementById('current-time').innerText = d.toLocaleString();
}, 1000);

// Initialize connection
connect();
lucide.createIcons();
initChart();

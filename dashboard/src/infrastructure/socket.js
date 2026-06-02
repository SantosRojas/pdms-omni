const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:9001/ws';

export const socketService = {
  ws: null,
  _onTelemetry: null,
  _onSerialStatus: null,
  _onConnect: null,
  _onDisconnect: null,
  _reconnectTimer: null,

  _connectors: new Set(),

  connect(key = 'default') {
    this._connectors.add(key);
    this._doConnect();
  },

  _doConnect() {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return; // Already connected or connecting
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }

    try {
      this.ws = new WebSocket(WS_URL);
    } catch (e) {
      console.error('[WS] Failed to create WebSocket:', e);
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log('[WS] Connected');
      if (this._onConnect) this._onConnect();
    };

    this.ws.onclose = () => {
      console.log('[WS] Disconnected');
      if (this._onDisconnect) this._onDisconnect();
      this._scheduleReconnect();
    };

    this.ws.onerror = (e) => {
      console.error('[WS] Error:', e);
    };

    this.ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        if (payload.type === 'telemetry' && payload.readings && this._onTelemetry) {
          this._onTelemetry(payload.readings);
        }

        if (payload.type === 'serial_status' && this._onSerialStatus) {
          this._onSerialStatus(payload);
        }
      } catch (e) {
        console.warn('[WS] Failed to parse message:', e);
      }
    };
  },

  _scheduleReconnect() {
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    this._reconnectTimer = setTimeout(() => {
      console.log('[WS] Attempting reconnect...');
      this._doConnect();
    }, 3000);
  },

  disconnect(key = 'default') {
    this._connectors.delete(key);
    if (this._connectors.size === 0) {
      if (this._reconnectTimer) {
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = null;
      }
      if (this.ws) {
        this.ws.onclose = null;
        this.ws.close();
        this.ws = null;
      }
    }
  },

  onTelemetry(callback) { this._onTelemetry = callback; },
  onSerialStatus(callback) { this._onSerialStatus = callback; },
  onConnect(callback) { this._onConnect = callback; },
  onDisconnect(callback) { this._onDisconnect = callback; },

  offTelemetry() { this._onTelemetry = null; },
  offSerialStatus() { this._onSerialStatus = null; },
};

let _token = null;

export function setWsToken(token) {
  _token = token;
}

function buildWsUrl() {
  return import.meta.env.VITE_WS_URL || '/ws';
}

export const socketService = {
  ws: null,
  _onTelemetry: null,
  _onSerialStatus: null,
  _onConnect: null,
  _onDisconnect: null,
  _reconnectTimer: null,
  _authenticated: false,

  _connectors: new Set(),

  connect(key = 'default') {
    this._connectors.add(key);
    this._doConnect();
  },

  _doConnect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (this._onConnect) this._onConnect();
      return;
    }
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      return;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }

    this._authenticated = false;

    try {
      this.ws = new WebSocket(buildWsUrl());
    } catch (e) {
      console.error('[WS] Failed to create WebSocket:', e);
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      // Send auth token as first message (never in URL)
      if (_token) {
        this.ws.send(JSON.stringify({ type: 'auth', token: _token }));
      }
      if (this._onConnect) this._onConnect();
    };

    this.ws.onclose = () => {
      this._authenticated = false;
      if (this._onDisconnect) this._onDisconnect();
      this._scheduleReconnect();
    };

    this.ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        // Handle auth response
        if (payload.type === 'auth_error') {
          console.warn('[WS] Auth failed:', payload.error);
          this.ws.close();
          return;
        }
        if (payload.type === 'auth_ok') {
          this._authenticated = true;
          return;
        }

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

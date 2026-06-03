const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:9001';

let authToken = localStorage.getItem('authToken') || null;

export const apiService = {
  setToken(token) {
    authToken = token;
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  },
  getToken() { return authToken; },

  _headers() {
    const h = { 'Content-Type': 'application/json' };
    if (authToken) h['Authorization'] = `Bearer ${authToken}`;
    return h;
  },

  // ─── Auth ─────────────────────────────────────────
  async login(username, password) {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    this.setToken(data.token);
    return data;
  },

  async logout() {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: this._headers(),
    }).catch(() => { });
    this.setToken(null);
  },

  async getMe() {
    const res = await fetch(`${API_BASE}/api/auth/me`, { headers: this._headers() });
    if (!res.ok) throw new Error('Not authenticated');
    return res.json();
  },

  // ─── Users ────────────────────────────────────────
  async getUsers() {
    const res = await fetch(`${API_BASE}/api/users`, { headers: this._headers() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async createUser(username, password, role) {
    const res = await fetch(`${API_BASE}/api/users`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({ username, password, role }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async updateUser(id, updates) {
    const res = await fetch(`${API_BASE}/api/users/${id}`, {
      method: 'PUT',
      headers: this._headers(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async deleteUser(id) {
    const res = await fetch(`${API_BASE}/api/users/${id}`, {
      method: 'DELETE',
      headers: this._headers(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  // ─── Equivalences ─────────────────────────────────
  async getEquivalences() {
    const res = await fetch(`${API_BASE}/api/equivalences`, { headers: this._headers() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async createEquivalence(internal_name, numeric_value, display_name) {
    const res = await fetch(`${API_BASE}/api/equivalences`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({ internal_name, numeric_value: parseFloat(numeric_value), display_name }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async deleteEquivalence(signal_id, numeric_value) {
    const params = new URLSearchParams({ signal_id: String(signal_id), numeric_value: String(numeric_value) });
    const res = await fetch(`${API_BASE}/api/equivalences?${params}`, {
      method: 'DELETE',
      headers: this._headers(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  // ─── Telemetry ────────────────────────────────────
  async getPatients() {
    const res = await fetch(`${API_BASE}/api/patients`, { headers: this._headers() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async getTherapies() {
    const res = await fetch(`${API_BASE}/api/therapies`, { headers: this._headers() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async getPatientHistory(patientIdStr, limit = 500) {
    const params = new URLSearchParams({ patient: patientIdStr, limit: String(limit) });
    const res = await fetch(`${API_BASE}/api/history?${params}`, { headers: this._headers() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async getTherapyHistory(therapyId, limit = 500) {
    const params = new URLSearchParams({ therapy_id: String(therapyId), limit: String(limit) });
    const res = await fetch(`${API_BASE}/api/therapy-history?${params}`, { headers: this._headers() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async downloadReport(patientIdStr, limit = 5000) {
    const params = new URLSearchParams({ patient: patientIdStr, limit: String(limit) });
    const res = await fetch(`${API_BASE}/api/export?${params}`, { headers: this._headers() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omni_report_${patientIdStr}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  async downloadTherapyReport(therapyId, limit = 5000) {
    const params = new URLSearchParams({ therapy_id: String(therapyId), limit: String(limit) });
    const res = await fetch(`${API_BASE}/api/therapy-export?${params}`, { headers: this._headers() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omni_therapy_${therapyId}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  // ─── Therapy Comments ──────────────────────────
  async getTherapyComments(therapyId) {
    const res = await fetch(`${API_BASE}/api/therapies/${therapyId}/comments`, { headers: this._headers() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async createTherapyComment(therapyId, authorName, comment) {
    const res = await fetch(`${API_BASE}/api/therapies/${therapyId}/comments`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({ author_name: authorName, comment }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async deleteTherapyComment(commentId, reason) {
    const res = await fetch(`${API_BASE}/api/therapies/comments/${commentId}`, {
      method: 'DELETE',
      headers: { ...this._headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  // ─── Serial Reader Control ────────────────────────
  async getSerialStatus() {
    const res = await fetch(`${API_BASE}/api/serial/status`, { headers: this._headers() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async startSerial(newTherapy = false) {
    const res = await fetch(`${API_BASE}/api/serial/start`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({ new_therapy: newTherapy }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async stopSerial() {
    const res = await fetch(`${API_BASE}/api/serial/stop`, {
      method: 'POST',
      headers: this._headers(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },
};

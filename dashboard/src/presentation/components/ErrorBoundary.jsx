import React from 'react';
import { Activity } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="loading-screen">
          <div style={{
            width: '72px', height: '72px', borderRadius: '18px',
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '8px',
          }}>
            <Activity size={32} color="#0f172a" />
          </div>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>Algo salió mal</h2>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', maxWidth: '400px', textAlign: 'center' }}>
            Ocurrió un error inesperado. Intenta recargar la página.
          </p>
          <button
            className="btn btn-primary"
            style={{ marginTop: '16px' }}
            onClick={() => {
              this.setState({ error: null });
              window.location.hash = '#/';
              window.location.reload();
            }}
          >
            Recargar
          </button>
          {import.meta.env.DEV && (
            <pre style={{ marginTop: '16px', fontSize: 'var(--fs-xxs)', color: '#ef4444', maxWidth: '600px', overflow: 'auto' }}>
              {this.state.error.message}
              {this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

import React from 'react';
import { LogoIcon } from './LogoIcon';
import { Button } from './Button';

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
          <LogoIcon variant="error" size={72} />
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>Algo salió mal</h2>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', maxWidth: '400px', textAlign: 'center' }}>
            Ocurrió un error inesperado. Intenta recargar la página.
          </p>
          <Button
            variant="primary"
            style={{ marginTop: '16px' }}
            onClick={() => {
              this.setState({ error: null });
              window.location.hash = '#/';
              window.location.reload();
            }}
          >
            Recargar
          </Button>
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

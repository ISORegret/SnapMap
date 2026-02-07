import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('snapmap_theme') : null;
document.documentElement.setAttribute('data-theme', stored === 'light' ? 'light' : 'dark');

registerSW({ immediate: true });

class AppErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('SnapMap render error', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui', color: '#e2e8f0', background: '#0f172a', minHeight: '100vh' }}>
          <h1 style={{ fontSize: 18, marginBottom: 8 }}>SnapMap failed to load</h1>
          <pre style={{ fontSize: 12, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{String(this.state.error?.message || this.state.error)}</pre>
          <p style={{ marginTop: 16, fontSize: 14 }}>Check the browser Console (F12) for details.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </AppErrorBoundary>
  </React.StrictMode>
);

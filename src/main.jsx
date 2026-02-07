import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('snapmap_theme') : null;
document.documentElement.setAttribute('data-theme', stored === 'light' ? 'light' : 'dark');

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);

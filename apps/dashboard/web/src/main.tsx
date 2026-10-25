import React from 'react';
import ReactDOM from 'react-dom/client';
import { initAnalytics } from '@megalith/analytics';
import { App } from './App';
import './styles/index.css';

// Initialize PostHog telemetry for the dashboard itself
initAnalytics({
  app: 'dashboard',
});

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

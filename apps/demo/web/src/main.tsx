import React from 'react';
import ReactDOM from 'react-dom/client';
import { initAnalytics } from '@megalith/analytics';
import App from './App';

// Initialize PostHog analytics for demo web service.
// Operates in silent no-op mode in local tests or when VITE_POSTHOG_KEY is not set.
initAnalytics({
  app: 'demo',
});

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

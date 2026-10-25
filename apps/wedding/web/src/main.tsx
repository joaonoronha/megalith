import React from 'react';
import ReactDOM from 'react-dom/client';
import { initAnalytics } from '@megalith/analytics';

import { App } from './App';

// Initialize PostHog analytics for the wedding application.
// Operates in silent no-op mode in local tests or when VITE_POSTHOG_KEY is not set.
initAnalytics({
  app: 'wedding',
  apiKey: import.meta.env.VITE_POSTHOG_KEY,
  apiHost: import.meta.env.VITE_POSTHOG_HOST,
  debug: import.meta.env.DEV,
});

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

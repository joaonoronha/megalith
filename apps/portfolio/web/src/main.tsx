import React from "react";
import ReactDOM from "react-dom/client";
import { initAnalytics } from "@megalith/analytics";
import { App } from "./App";
import "./styles/index.css";

// Initialize PostHog analytics for portfolio showcase.
// Operates in silent no-op mode in local tests or when VITE_POSTHOG_KEY is not set.
initAnalytics({
  app: "portfolio",
  apiKey: import.meta.env.VITE_POSTHOG_KEY,
  apiHost: import.meta.env.VITE_POSTHOG_HOST,
  debug: import.meta.env.DEV,
});

const rootElement = document.getElementById("root");

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

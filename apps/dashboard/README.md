# Megalith Telemetry & Analytics Dashboard

A centralized, responsive telemetry and analytics dashboard for the Megalith monorepo.

Displays cross-product metrics, conversion funnels, audience breakdowns, and real-time event feeds across all deployed products (`wedding`, `portfolio`, `demo`) using PostHog.

## Architecture

- **Service**: `apps/dashboard/web`
- **Port**: `5176` (local development)
- **Tech Stack**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React
- **Data Source**: PostHog EU Cloud via `@megalith/analytics` and HogQL Query API
- **Deployment**: Static SPA bundle deployable to GitHub Pages, Cloudflare Pages, or container ingress.

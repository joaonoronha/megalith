# Madalena & João Wedding Invitation (`wedding`)

A luxurious, mobile-first, animated multilingual wedding invitation website celebrating the wedding of Madalena & João at Quinta da Grilla, Portugal on 16 August 2027.

## Overview

The `wedding` product provides an interactive wedding invitation web application featuring:
1. **Multilingual i18n Engine**: European Portuguese (`pt-PT`) as the canonical source of truth, with English (`en`) and French (`fr`) translations maintaining 100% key symmetry and automatic browser language detection.
2. **Layered Entrance Animation**: Declarative hero entrance sequence powered by `motion` (Motion for React 12), respectful of `prefers-reduced-motion`.
3. **Live Countdown & Calendar Integration**: Timezone-safe countdown to 16 August 2027 16:00 WEST (`2027-08-16T15:00:00Z`), with .ics calendar file generation and Google Calendar deep links.
4. **Venue & Schedule Guide**: Interactive venue card for Quinta da Grilla (Alenquer / Lisbon district) with Google Maps / Apple Maps integration and chronological event itinerary.
5. **RSVP & Practical Details**: Bilingual RSVP deadline and accommodation/dress code guidelines.

---

## Architecture & Service Topology

```
apps/wedding/
├── product.yaml           # Product manifest declaring web service
├── README.md              # Product documentation and developer guide
└── web/                   # React + TypeScript + Vite frontend (wedding/web)
    ├── service.yaml       # Service manifest (port 8080, dev port 5174)
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx
        ├── setupTests.ts
        ├── config/        # Immutable event facts
        ├── i18n/          # Locales and language detector
        ├── components/    # Reusable UI components & sections
        └── styles/        # CSS design tokens and typography
```

### Services

| Service | Qualified ID | Runtime | Role | Port | Dev Port |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Web** | `wedding/web` | TypeScript 5.7+ / React 19 / Vite 6 | Client-rendered wedding invitation | `8080` | `5174` |

---

## Developer Guide

### Prerequisites
- Node.js `>= 20.0.0`
- pnpm `>= 9.0.0`
- Python `>= 3.11` (for monorepo validation tooling)

### 1. Install Dependencies
```bash
cd apps/wedding/web
pnpm install
```

### 2. Run Commands

From repository root:
```bash
# Validate manifests
python3 tooling/validate.py

# Run web service checks and tests
pnpm --dir apps/wedding/web run check
pnpm --dir apps/wedding/web run test
pnpm --dir apps/wedding/web run build
```

Or within `apps/wedding/web`:
```bash
# Start local Vite dev server on http://localhost:5174
pnpm dev

# Run Vitest test suite
pnpm test

# Type check
pnpm check

# Production bundle build
pnpm build
```

---

## Deployment & Domain Configuration

The `wedding/web` application is continuously deployed to GitHub Pages and served under the custom apex domain **`madalenaejoao.pt`**.

### Custom Domain & DNS Settings

To route traffic to GitHub Pages, DNS records must be configured with the domain registrar / DNS provider for `madalenaejoao.pt`:

| Record Type | Host / Name | Target / Value | Purpose |
| :--- | :--- | :--- | :--- |
| **A** | `@` | `185.199.108.153` | GitHub Pages Anycast IPv4 |
| **A** | `@` | `185.199.109.153` | GitHub Pages Anycast IPv4 |
| **A** | `@` | `185.199.110.153` | GitHub Pages Anycast IPv4 |
| **A** | `@` | `185.199.111.153` | GitHub Pages Anycast IPv4 |
| **AAAA** | `@` | `2606:50c0:8000::153` | GitHub Pages Anycast IPv6 |
| **AAAA** | `@` | `2606:50c0:8001::153` | GitHub Pages Anycast IPv6 |
| **AAAA** | `@` | `2606:50c0:8002::153` | GitHub Pages Anycast IPv6 |
| **AAAA** | `@` | `2606:50c0:8003::153` | GitHub Pages Anycast IPv6 |
| **CNAME** | `www` | `joaonoronha.github.io.` | Subdomain alias / redirect to apex |

#### GitHub Pages Repository Settings
- **Source**: Deploy from GitHub Actions
- **Custom domain**: `madalenaejoao.pt`
- **Enforce HTTPS**: Enabled (automated TLS certificate provisioning via Let's Encrypt upon DNS resolution)

### GitHub Actions Deployment Model

The deployment workflow is defined in [`.github/workflows/wedding-pages.yaml`](file:///.github/workflows/wedding-pages.yaml).

- **Automated Triggers**: Triggers on `push` to `main` when changes affect `apps/wedding/web/**` or `.github/workflows/wedding-pages.yaml`.
- **Pipeline Stages**:
  1. **Dependencies**: `pnpm install` using Node.js 20 and pnpm 9.
  2. **Type Check**: `pnpm run check` (TypeScript verification).
  3. **Automated Tests**: `pnpm run test` (Vitest unit and component test suites).
  4. **Production Build**: `pnpm run build` generates the static bundle into `dist/`, including `CNAME` (`madalenaejoao.pt`) and `404.html` (SPA fallback redirect).
  5. **Artifact Upload**: `actions/upload-pages-artifact@v3` uploads the built bundle.
  6. **Deployment**: `actions/deploy-pages@v4` publishes the artifact to GitHub Pages under the `github-pages` environment.
- **Concurrency**: Governed by the `pages` concurrency group with `cancel-in-progress: false` to ensure atomic, non-overlapping deployments.

### Manual Deployment (`workflow_dispatch`)

In addition to automated pushes to `main`, deployments can be dispatched on demand via the GitHub UI:

1. Navigate to the repository on GitHub.
2. Click on the **Actions** tab in the main repository navigation.
3. In the left sidebar, select the **Deploy Wedding Web to GitHub Pages** workflow.
4. Click the **Run workflow** dropdown on the right side of the workflow banner.
5. Choose branch `main` and click **Run workflow**.

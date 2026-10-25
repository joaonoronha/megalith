# João Noronha Portfolio & Digital CV (`portfolio`)

A high-performance, responsive personal website and digital CV showcasing João Noronha's engineering leadership, career trajectory, featured initiatives at Dialpad, and AI-native software delivery philosophy.

## Overview

The `portfolio` product provides:
1. **Executive Profile & Highlights**: High-impact metrics (9 direct reports, 70k+ customers reached, 50+ engineers onboarded, 10+ years shipping).
2. **Career Timeline & Deep Dives**: Detailed overview of roles at Dialpad (Engineering Manager, Senior SWE, SWE), Hugo Boss, and AT&T with project details, challenges, solutions, and impact.
3. **Interactive "How I Build with AI"**: 6-stage structured methodology and philosophy for agentic, spec-driven engineering.
4. **Toolbox & Recognition**: Categorized technical stacks and career milestones.
5. **Print & PDF Support**: Dedicated clean print styles (`@media print`) for recruiter/executive PDF generation.

---

## Architecture & Service Topology

```
apps/portfolio/
├── product.yaml           # Product manifest declaring web service
├── README.md              # Product documentation and developer guide
├── AGENTS.md              # AI agent guidelines for portfolio
└── web/                   # React 19 + TypeScript + Vite 6 frontend (portfolio/web)
    ├── service.yaml       # Service manifest (static deployment, dev port 5175)
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── data/          # Profile, career timeline, and AI workflow data
        ├── components/    # Modular UI components
        ├── styles/        # CSS design tokens & print styles
        └── tests/         # Unit and component tests
```

---

## Developer Guide

### Prerequisites
- Node.js `>= 20.0.0`
- pnpm `>= 9.0.0`

### Commands
From `apps/portfolio/web`:
```bash
# Run local dev server (port 5175)
pnpm dev

# Type-check
pnpm check

# Run tests
pnpm test

# Build production static bundle
pnpm build
```

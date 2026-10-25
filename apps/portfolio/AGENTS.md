# Portfolio AI Agent Guidelines

This document outlines the rules for AI coding agents operating within `apps/portfolio/`.

## 1. Scope and Isolation
- Strictly modify only files within `apps/portfolio/`.
- Do not import code directly from other products in `apps/`.
- Shared logic or utilities across products must reside in `packages/`.

## 2. Code Quality & Standards
- Maintain strict TypeScript type safety (`strict: true`).
- Ensure all content edits accurately reflect João Noronha's actual experience and verified impact.
- Keep the visual aesthetic clean, professional, and accessible.
- Support both dark and light modes cleanly with semantic CSS design tokens.
- Maintain responsive design for mobile, tablet, and desktop viewports.
- Maintain `@media print` fidelity for clean PDF résumé generation.

## 3. Verification
Before completing any task:
```bash
cd apps/portfolio/web
pnpm check
pnpm test
pnpm build
```
And from repository root:
```bash
.venv/bin/python3 tooling/validate.py
```

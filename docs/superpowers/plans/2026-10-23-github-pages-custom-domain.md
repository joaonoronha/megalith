# GitHub Pages & Custom Domain Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish automated CI/CD deployment of `apps/wedding/web` to GitHub Pages under custom apex domain `madalenaejoao.pt`.

**Architecture:** Use native GitHub Actions Pages deployment (`actions/upload-pages-artifact` + `actions/deploy-pages`) triggered on push to `main` (for `apps/wedding/web/**`) and manual dispatch. Bundle `public/CNAME` (`madalenaejoao.pt`) and `public/404.html` via Vite with `base: '/'`.

**Tech Stack:** GitHub Actions, Vite 6, pnpm 9, Vitest 3, React 19, TypeScript 5.7.

**Spec:** [`docs/superpowers/specs/2026-10-23-github-pages-custom-domain-design.md`](file:///workspaces/megalith/docs/superpowers/specs/2026-10-23-github-pages-custom-domain-design.md)

## Global Constraints

- **Product Scope:** Only touches `apps/wedding/web` and `.github/workflows/wedding-pages.yaml`; zero edits to `apps/demo`.
- **Custom Domain:** Canonical apex domain is `madalenaejoao.pt` (no trailing slash, lowercase).
- **Vite Base:** Explicit `base: '/'` in `vite.config.ts`.
- **Validation:** Repository must pass `python3 tooling/validate.py` and `pytest tooling/tests`.
- **Quality Gates:** `pnpm run check` and `pnpm run test` must pass before production build and artifact upload.

## Review Focus

1. **Missing CNAME in build artifact:** If CNAME is missing from `dist/`, GitHub Pages unbinds the custom domain on deployment.
2. **Path truncation on 404 redirect:** When navigating to deep links or query parameters, `404.html` must redirect to `/` with parameters intact.
3. **Workflow path filtering:** Changes outside `apps/wedding/web/**` or the workflow itself must not trigger deployment builds.
4. **Frozen lockfile failure in CI:** Workflow must use `pnpm install --frozen-lockfile` (or `pnpm install`) reliably.
5. **Vite asset resolution:** Asset paths must not produce broken relative URLs when loaded from the apex domain root.

---

### Task 1: CNAME, 404 Fallback & Vite Configuration

**Files:**
- Create: `apps/wedding/web/public/CNAME`
- Create: `apps/wedding/web/public/404.html`
- Create: `apps/wedding/web/tests/deployment-artifacts.test.ts`
- Modify: `apps/wedding/web/vite.config.ts`

**Interfaces:**
- Produces: `dist/CNAME` and `dist/404.html` upon `pnpm build`.

- [ ] **Step 1: Write test for deployment artifact expectations**

Write `apps/wedding/web/tests/deployment-artifacts.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Deployment Artifacts & Configuration', () => {
  it('has public/CNAME containing canonical domain', () => {
    const cnamePath = path.resolve(__dirname, '../public/CNAME');
    expect(fs.existsSync(cnamePath)).toBe(true);
    const content = fs.readFileSync(cnamePath, 'utf-8').trim();
    expect(content).toBe('madalenaejoao.pt');
  });

  it('has public/404.html for SPA redirect fallback', () => {
    const fallbackPath = path.resolve(__dirname, '../public/404.html');
    expect(fs.existsSync(fallbackPath)).toBe(true);
    const content = fs.readFileSync(fallbackPath, 'utf-8');
    expect(content).toContain('location.replace');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm --dir apps/wedding/web run test apps/wedding/web/tests/deployment-artifacts.test.ts
```
Expected: FAIL (files do not exist yet).

- [ ] **Step 3: Create `apps/wedding/web/public/CNAME`**

Write `apps/wedding/web/public/CNAME` with:
```text
madalenaejoao.pt
```

- [ ] **Step 4: Create `apps/wedding/web/public/404.html`**

Write `apps/wedding/web/public/404.html` with:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Redirecting...</title>
    <script>
      (function () {
        var path = window.location.pathname;
        var search = window.location.search;
        var hash = window.location.hash;
        // Redirect back to root preserving query & hash
        window.location.replace('/' + search + hash);
      })();
    </script>
  </head>
  <body>
    <p>Redirecting to <a href="/">madalenaejoao.pt</a>...</p>
  </body>
</html>
```

- [ ] **Step 5: Ensure `base: '/'` in `apps/wedding/web/vite.config.ts`**

Update `apps/wedding/web/vite.config.ts`:
```typescript
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    port: 5174,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  },
});
```

- [ ] **Step 6: Run test and verify it passes**

Run:
```bash
pnpm --dir apps/wedding/web run test apps/wedding/web/tests/deployment-artifacts.test.ts
```
Expected: PASS.

- [ ] **Step 7: Build bundle and verify output artifacts**

Run:
```bash
pnpm --dir apps/wedding/web run build
```
Check that `apps/wedding/web/dist/CNAME` exists and equals `madalenaejoao.pt`.

- [ ] **Step 8: Commit Task 1**

```bash
git add apps/wedding/web/public/CNAME apps/wedding/web/public/404.html apps/wedding/web/tests/deployment-artifacts.test.ts apps/wedding/web/vite.config.ts
git commit -m "feat(wedding/web): add CNAME, 404 fallback, and root base config for GitHub Pages"
```

---

### Task 2: GitHub Actions Workflow for GitHub Pages Deployment

**Files:**
- Create: `.github/workflows/wedding-pages.yaml`

**Interfaces:**
- Consumes: `apps/wedding/web` build and test commands.
- Produces: Deployed GitHub Pages environment at `madalenaejoao.pt`.

- [ ] **Step 1: Write `.github/workflows/wedding-pages.yaml`**

Create `.github/workflows/wedding-pages.yaml`:
```yaml
name: Deploy Wedding Web to GitHub Pages

on:
  push:
    branches:
      - main
    paths:
      - "apps/wedding/web/**"
      - ".github/workflows/wedding-pages.yaml"
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    name: Build & Verify
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"
          cache-dependency-path: "apps/wedding/web/pnpm-lock.yaml"

      - name: Install dependencies
        run: pnpm --dir apps/wedding/web install

      - name: Type-check
        run: pnpm --dir apps/wedding/web run check

      - name: Run unit & component tests
        run: pnpm --dir apps/wedding/web run test

      - name: Build production bundle
        run: pnpm --dir apps/wedding/web run build

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: apps/wedding/web/dist

  deploy:
    name: Deploy to GitHub Pages
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Validate YAML syntax and action structure**

Run:
```bash
python3 -c "import yaml; data = yaml.safe_load(open('.github/workflows/wedding-pages.yaml')); assert 'jobs' in data; print('YAML valid')"
```
Expected: `YAML valid`.

- [ ] **Step 3: Commit Task 2**

```bash
git add .github/workflows/wedding-pages.yaml
git commit -m "ci: add GitHub Actions workflow for wedding web Pages deployment"
```

---

### Task 3: Documentation & Deployment Guide

**Files:**
- Modify: `apps/wedding/README.md`

**Interfaces:**
- Produces: Clear developer and operator documentation for domain verification, DNS settings, and automated deployments.

- [ ] **Step 1: Update `apps/wedding/README.md` with Deployment section**

Add a dedicated section to `apps/wedding/README.md` detailing:
- Custom Domain: `madalenaejoao.pt`
- DNS Records summary (A, AAAA, CNAME)
- GitHub Actions deployment model
- How to trigger manual deployment via GitHub UI (`workflow_dispatch`)

- [ ] **Step 2: Commit Task 3**

```bash
git add apps/wedding/README.md
git commit -m "docs(wedding): document GitHub Pages and custom domain DNS configuration"
```

---

### Task 4: Full Monorepo & Service Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run monorepo validators**

Run:
```bash
python3 tooling/validate.py
pytest tooling/tests
```
Expected: All checks PASS with code 0.

- [ ] **Step 2: Run all web tests and checks**

Run:
```bash
pnpm --dir apps/wedding/web run check
pnpm --dir apps/wedding/web run test
pnpm --dir apps/wedding/web run build
```
Expected: All typechecks, test suites, and build PASS with code 0.

- [ ] **Step 3: Verify dist integrity**

Run:
```bash
test -f apps/wedding/web/dist/CNAME && grep -q "madalenaejoao.pt" apps/wedding/web/dist/CNAME && echo "CNAME verified"
test -f apps/wedding/web/dist/404.html && echo "404.html verified"
test -f apps/wedding/web/dist/index.html && echo "index.html verified"
```
Expected: All three verified.

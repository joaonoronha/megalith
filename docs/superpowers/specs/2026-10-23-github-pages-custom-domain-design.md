# Design Specification: GitHub Pages Deployment & Custom Domain for Wedding App

**Date:** 2026-10-23  
**Status:** Approved  
**Author:** Antigravity  
**Target Product:** `apps/wedding` (`web` service: `apps/wedding/web`)  
**Target Domain:** `madalenaejoao.pt` (with `www.madalenaejoao.pt` redirect)  

---

## 1. Overview & Goal

The goal is to establish an automated, zero-maintenance continuous deployment pipeline for the Madalena & João wedding invitation web application (`apps/wedding/web`) to GitHub Pages, pointed at the apex custom domain `madalenaejoao.pt`.

The architecture uses native GitHub Actions Pages deployment (avoiding orphan `gh-pages` branch bloat in the monorepo), Vite static build outputs with automatic `CNAME` bundling, and custom 404 routing fallback for single-page application stability.

---

## 2. Architecture & File Layout

### 2.1 File Additions & Modifications

1. **Custom Domain Specification (`apps/wedding/web/public/CNAME`)**:
   * Content: `madalenaejoao.pt`
   * Vite automatically copies files in `public/` directly to the `dist/` root on build, ensuring the deployment artifact always contains the canonical CNAME.

2. **Vite Base URL Configuration (`apps/wedding/web/vite.config.ts`)**:
   * Set `base: '/'` explicitly. Because the site serves from the root of `madalenaejoao.pt` rather than a repository path like `/<repo>/`, absolute path references (`/assets/...`) resolve without path rewriting.

3. **SPA Fallback Routing (`apps/wedding/web/public/404.html`)**:
   * Standard GitHub Pages static fallback that redirects any requested sub-paths back to the application entrypoint (`/`) preserving search params and hash fragments.

4. **GitHub Actions Workflow (`.github/workflows/wedding-pages.yaml`)**:
   * Declarative workflow that automates testing, bundling, artifact upload, and deployment to GitHub Pages.

---

## 3. GitHub Actions Workflow Specification

* **Path:** `.github/workflows/wedding-pages.yaml`
* **Name:** `Deploy Wedding Web to GitHub Pages`
* **Triggers:**
  * `push` to `main` filtered by paths:
    * `apps/wedding/web/**`
    * `.github/workflows/wedding-pages.yaml`
  * `workflow_dispatch` (manual trigger for ad-hoc releases or initial testing)
* **Concurrency:**
  ```yaml
  concurrency:
    group: "pages"
    cancel-in-progress: false
  ```
* **Permissions:**
  ```yaml
  permissions:
    contents: read
    pages: write
    id-token: write
  ```
* **Jobs:**
  1. `build`:
     * Runner: `ubuntu-latest`
     * Node version: `20`
     * Package manager: `pnpm` (latest v9)
     * Steps:
       * Checkout repository (`actions/checkout@v4`)
       * Setup pnpm (`pnpm/action-setup@v4`)
       * Setup Node.js (`actions/setup-node@v4` with pnpm cache)
       * Install dependencies: `pnpm --dir apps/wedding/web install --frozen-lockfile`
       * Typecheck: `pnpm --dir apps/wedding/web run check`
       * Unit tests: `pnpm --dir apps/wedding/web run test`
       * Build: `pnpm --dir apps/wedding/web run build`
       * Configure Pages: `actions/configure-pages@v5`
       * Upload Artifact: `actions/upload-pages-artifact@v3` pointing to `apps/wedding/web/dist`
  2. `deploy`:
     * Environment: `github-pages` (url: `${{ steps.deployment.outputs.page_url }}`)
     * Needs: `build`
     * Steps:
       * Deploy to Pages: `actions/deploy-pages@v4` (id: `deployment`)

---

## 4. DNS & Domain Configuration Specification

The custom domain `madalenaejoao.pt` is configured with the following DNS records pointing to GitHub Pages Anycast servers:

### 4.1 Apex Domain Records (`madalenaejoao.pt`)
* **IPv4 (Type A):**
  * `@` -> `185.199.108.153`
  * `@` -> `185.199.109.153`
  * `@` -> `185.199.110.153`
  * `@` -> `185.199.111.153`
* **IPv6 (Type AAAA):**
  * `@` -> `2606:50c0:8000::153`
  * `@` -> `2606:50c0:8001::153`
  * `@` -> `2606:50c0:8002::153`
  * `@` -> `2606:50c0:8003::153`

### 4.2 Subdomain Records (`www.madalenaejoao.pt`)
* **CNAME:**
  * `www` -> `joaonoronha.github.io.`

### 4.3 GitHub Repository Configuration
1. GitHub Pages Source: **GitHub Actions**
2. Custom Domain: `madalenaejoao.pt`
3. Enforce HTTPS: **Enabled** (issued via Let's Encrypt once DNS propagates)

---

## 5. Quality, Monorepo Integrity & Verification

1. **Manifest & Monorepo Validation**:
   * Must continue to pass `python3 tooling/validate.py`.
   * Must pass `pytest tooling/tests`.
2. **Web Service Verification**:
   * `pnpm --dir apps/wedding/web run check` passes without TypeScript errors.
   * `pnpm --dir apps/wedding/web run test` passes all Vitest test suites.
   * `pnpm --dir apps/wedding/web run build` bundles successfully without missing asset links.
   * Check that `dist/CNAME` exists with exact content `madalenaejoao.pt\n`.
   * Check that `dist/404.html` exists.

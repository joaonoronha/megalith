# Megalith Edge Ingress — Caddy Configuration

This directory contains the production and local edge ingress reverse proxy configurations for Megalith using Caddy.

---

## 1. Role & Architecture

Caddy serves as the public HTTP/HTTPS entry point for Megalith's product suite in the production-oriented topology, implementing the requirements of **ADR-006 (Ingress and Reverse Proxy Strategy)** and **ADR-010 (Operational Resilience)**.

### Key Characteristics:
* **Single Public Ingress:** In production, Caddy is the only service that publishes ports to the host (`80` for HTTP-01 challenges and HTTPS redirection; `443` for TLS traffic).
* **Network Segmentation:** Caddy is joined exclusively to `edge-network`. It has direct access to HTTP service endpoints (`demo-web`, `demo-api`), but **no direct access** to the private persistence tier (`postgres` on `data-network`).
* **Direct Route Segregation:**
  - Requests to `/api*` route directly to the backend application runtime (`demo-api:8000`).
  - Requests to all other paths route to the static asset server (`demo-web:8080`).
  - This avoids unnecessary frontend hops for API traffic and ensures backend downtime returns a standard `502 Bad Gateway` rather than leaking frontend SPA HTML (`index.html`) to API consumers.
* **Automatic HTTPS:** Caddy manages Let's Encrypt / ZeroSSL certificate issuance, renewal, and OCSP stapling automatically without external cron jobs or certbot sidecars.

---

## 2. Container Image & Hardening

* **Pinned Image:** `caddy:2.9-alpine@sha256:b4e3952384eb9524a887633ce65c752dd7c71314d2c2acf98cd5c715aaa534f0`
* **Multi-Architecture Support:** Built for both `linux/amd64` and `linux/arm64` (targeting OCI Ampere A1).
* **Capability Dropping:**
  ```yaml
  cap_drop:
    - ALL
  cap_add:
    - NET_BIND_SERVICE
  security_opt:
    - no-new-privileges:true
  ```
  `NET_BIND_SERVICE` allows binding to privileged low ports (`80`, `443`) while running unprivileged. All other Linux kernel capabilities are dropped.

---

## 3. Configuration Files

### Production Configuration (`Caddyfile`)
Used in production deployment via `platform/deploy/compose.prod.yaml`:
* Global options: disables administrative API endpoint (`admin off`).
* Site block: handles `demo.{$DOMAIN:-example.com}` with automatic HTTPS.
* Response headers:
  - `Strict-Transport-Security: max-age=31536000` (host-scoped without `includeSubDomains`)
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`
  - Server identity header stripped (`-Server`).

### Local Verification Configuration (`Caddyfile.local`)
Used during CI and local testing via `platform/deploy/compose.local-ingress.yaml`:
* Global options: `auto_https off` and `admin off`.
* Site block: binds to HTTP `:80` (mapped to collision-resistant host port `${INGRESS_PORT:-18082}`).
* Handles both explicit host routing (`demo.example.com`) and default catch-all for `localhost` / `127.0.0.1`.
* Mirrors all production routing rules and security headers, omitting HSTS to avoid poisoning developer browser caches.

---

## 4. Persistent Storage & Certificate State

Caddy persists state across container recreations via two named volumes:
* `caddy-data` (`/data`): Stores issued TLS certificates, private keys, and ACME account metadata.
* `caddy-config` (`/config`): Stores Caddy runtime configuration cache.

Backing up the `caddy-data` volume preserves certificates and avoids hitting ACME rate limits upon container restarts.

---

## 5. Local Verification

To validate Caddy configurations locally without starting the stack:
```bash
docker run --rm \
  -v "$PWD/platform/deploy/caddy/Caddyfile:/etc/caddy/Caddyfile:ro" \
  caddy:2.9-alpine@sha256:b4e3952384eb9524a887633ce65c752dd7c71314d2c2acf98cd5c715aaa534f0 \
  caddy validate --adapter caddyfile --config /etc/caddy/Caddyfile
```

To run the full end-to-end automated ingress verification suite:
```bash
python3 tooling/verify_ingress.py
```

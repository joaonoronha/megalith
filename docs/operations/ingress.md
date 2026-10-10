# Edge Ingress Operations & Troubleshooting Guide

This guide covers operational lifecycle management, local verification, troubleshooting, and production deployment procedures for the Caddy edge ingress service in Megalith.

---

## 1. Operational Overview

Caddy manages public HTTP/HTTPS termination, TLS certificate lifecycle, and reverse-proxy routing to product services.

### Key Components:
* **Configuration:**
  - Production: `platform/deploy/caddy/Caddyfile`
  - Local verification: `platform/deploy/caddy/Caddyfile.local`
* **Docker Compose Overlays:**
  - Production: `platform/deploy/compose.prod.yaml`
  - Local verification: `platform/deploy/compose.local-ingress.yaml`
* **Storage Volumes:**
  - `caddy-data`: ACME certificates and private keys (`/data`).
  - `caddy-config`: Internal configuration cache (`/config`).

---

## 2. Automated Verification

The repository includes a standalone automated verification script: `tooling/verify_ingress.py`.

It validates:
1. Production and local Caddyfile syntax via `caddy validate`.
2. Stack startup using a dedicated Docker Compose project (`megalith-ingress-verify`) on port `18082`.
3. Edge ingress routing to the frontend SPA (`GET /`).
4. Client-side Single-Page Application routing fallback (`GET /settings`).
5. Direct backend API routing (`GET /api/message`, `GET /api/counter`).
6. State mutation through ingress (`POST /api/counter/increment`).
7. Query parameter and header preservation.
8. Hostname-based virtual host routing (`Host: demo.example.com`).
9. Defense-in-depth security headers (`Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, suppression of `Server`).
10. Absence of HSTS in local HTTP testing mode.
11. Port exposure privacy: ensures ports `8000`, `8080`, and `5432` are **not** exposed to the host interface.
12. Network segmentation: validates that Caddy on `edge-network` cannot reach `postgres` on `data-network`.
13. API outage handling: verifies Caddy returns `502 Bad Gateway` for `/api/*` when `demo-api` is stopped, without leaking frontend HTML.
14. Automatic recovery when `demo-api` restarts.
15. Clean teardown and volume cleanup.

### Running Verification:
```bash
python3 tooling/verify_ingress.py
```

---

## 3. Local Development Workflows

### Option A: Standalone Dev Mode (No Ingress)
For frontend/backend development without running Caddy:
```bash
docker compose -f platform/deploy/compose.yaml up -d
```
Access the application directly via `http://localhost:8080`. Nginx handles internal proxying of `/api/` to `demo-api:8000`.

### Option B: Local Ingress Mode
To test the complete routing topology locally using Caddy:
```bash
docker compose \
  -f platform/deploy/compose.yaml \
  -f platform/deploy/compose.local-ingress.yaml \
  up -d
```
Access via `http://localhost:18082` or with a custom host header:
```bash
curl -H "Host: demo.example.com" http://localhost:18082/api/message
```

To shut down:
```bash
docker compose \
  -f platform/deploy/compose.yaml \
  -f platform/deploy/compose.local-ingress.yaml \
  down
```

---

## 4. Production Deployment Preparation (Future OCI Milestone)

When deploying to the OCI Always Free instance in a future milestone:

### Prerequisites:
1. **Public DNS:** Configure an `A` record pointing `demo.<your-domain>` to the OCI instance public IP.
2. **Network Security Group (NSG):** Ensure inbound TCP ports `80` and `443` are allowed in the OCI NSG (as defined in `platform/infra/oci/network.tf`).
3. **Host Firewall:** Ensure `ufw` or `iptables` allows inbound traffic on ports `80` and `443`.
4. **Environment Configuration:** Set `DOMAIN` in `platform/deploy/.env`:
   ```bash
   DOMAIN=yourdomain.com
   ```

### Starting the Production Stack:
```bash
docker compose \
  -f platform/deploy/compose.yaml \
  -f platform/deploy/compose.prod.yaml \
  up -d
```

---

## 5. TLS Certificate Management & Backups

### Automatic Issuance
Caddy handles ACME issuance automatically on first request to the configured domain:
* Solves HTTP-01 or TLS-ALPN-01 challenges.
* Stores certificates in `/data/caddy/certificates/` inside the `caddy-data` volume.
* Automatically renews certificates approximately 30 days before expiration.

### Backing Up Certificates
To avoid hitting Let's Encrypt rate limits during redeployments or disaster recovery, backup the `caddy-data` volume:
```bash
docker run --rm \
  -v megalith_caddy-data:/data:ro \
  -v "$PWD/backups:/backup" \
  alpine tar czf /backup/caddy-certificates-$(date +%Y%m%d).tar.gz -C /data .
```

### Restoring Certificates:
```bash
docker run --rm \
  -v megalith_caddy-data:/data \
  -v "$PWD/backups:/backup:ro" \
  alpine tar xzf /backup/caddy-certificates-<date>.tar.gz -C /data
```

---

## 6. Troubleshooting & Diagnostics

### Viewing Ingress Logs
```bash
docker compose -f platform/deploy/compose.yaml -f platform/deploy/compose.prod.yaml logs -f caddy
```

### Diagnosing `502 Bad Gateway`
A `502 Bad Gateway` indicates Caddy cannot connect to the upstream service (`demo-api:8000` or `demo-web:8080`).
1. Check container status:
   ```bash
   docker compose ps
   ```
2. Verify container health:
   ```bash
   docker inspect --format '{{.State.Health.Status}}' megalith-demo-api-1
   ```
3. Check upstream application logs:
   ```bash
   docker compose logs demo-api
   ```

### Validating Caddy Configuration Syntax
```bash
docker run --rm \
  -v "$PWD/platform/deploy/caddy/Caddyfile:/etc/caddy/Caddyfile:ro" \
  caddy:2.9-alpine@sha256:b4e3952384eb9524a887633ce65c752dd7c71314d2c2acf98cd5c715aaa534f0 \
  caddy validate --adapter caddyfile --config /etc/caddy/Caddyfile
```

# Architecture: Edge Ingress, Network Segmentation, and Reverse Proxy

This document outlines the architectural design, network isolation model, routing strategy, and security parameters of the edge ingress layer in Megalith.

---

## 1. Context and Strategic Requirements

Megalith hosts multiple independent product services in a unified polyglot monorepo, targeting an Oracle Cloud Infrastructure (OCI) Always Free Ampere A1 instance.

Under **ADR-006 (Ingress and Reverse Proxy Strategy)**, Megalith designates **Caddy** as the reverse proxy and ingress entry point.

Strategic requirements:
1. **Single Entry Point:** In production, no backend or database containers may expose ports to the public network or host interface. All incoming HTTP/HTTPS traffic enters through Caddy.
2. **Network Segmentation:** The architecture enforces a strict two-tier container network separation (`edge-network` and `data-network`). Caddy must not be able to address or access the database tier.
3. **Route Segregation & Failure Isolation:** Ingress directs traffic specifically to the target tier:
   - `/api*` traffic is routed directly to the backend application runtime (`demo-api:8000`).
   - Static assets and frontend SPA navigation are routed to the frontend web server (`demo-web:8080`).
   - If the backend is degraded or down, API requests return an unambiguous `502 Bad Gateway` from Caddy, preventing frontend Single-Page Application (SPA) HTML fallback files (`index.html`) from leaking into API consumers.
4. **Automated TLS & Secure Defaults:** Automated ACME certificate issuance and renewal without external cron jobs or sidecars. Defense-in-depth HTTP security headers applied uniformly at the edge.
5. **Multi-Product Extensibility:** Future products (e.g. `product-b.example.com`, `product-c.example.com`) follow the same declarative host-based routing pattern without re-architecting the ingress infrastructure.

---

## 2. Network Topology & Segmentation

The container topology partitions services across two isolated bridge networks:

```
                            INTERNET (Public)
                                   |
                         Ports 80 & 443 (Prod)
                                   |
                      +-------------------------+
                      |   Caddy Reverse Proxy   |
                      |       (edge-network)    |
                      +-------------------------+
                                   |
        +--------------------------+--------------------------+
        |                                                     |
  (All paths except /api*)                              (Path /api*)
        |                                                     |
        v                                                     v
+------------------+                                  +------------------+
|     demo-web     |                                  |     demo-api     |
|   (Nginx SPA)    |                                  | (FastAPI Runtime)|
|                  |                                  |                  |
|  [edge-network]  |                                  |  [edge-network]  |
+------------------+                                  |  [data-network]  |
                                                      +------------------+
                                                               |
                                                          (Port 5432)
                                                               |
                                                               v
                                                      +------------------+
                                                      |     postgres     |
                                                      |  (PostgreSQL 16) |
                                                      |                  |
                                                      |  [data-network]  |
                                                      +------------------+
```

### Network Membership Matrix

| Service | `edge-network` | `data-network` | Host Ports Published (Prod) | Host Ports Published (Dev) |
|---|---|---|---|---|
| **caddy** | **Yes** | **No** | `80:80`, `443:443` | N/A (or `18082:80` in local-ingress mode) |
| **demo-web** | **Yes** | **No** | None (`!reset []`) | `8080:8080` (Direct SPA dev access) |
| **demo-api** | **Yes** | **Yes** | None | None |
| **demo-migrate** | **No** | **Yes** | None | None |
| **postgres** | **No** | **Yes** | None | None |

### Isolation Properties:
* **Ingress-to-Database Isolation:** Caddy is isolated from `data-network`. If an attacker compromises Caddy or exploits an ingress vulnerability, they have no direct network route to port 5432 on the `postgres` container.
* **Web-to-Database Isolation:** `demo-web` (Nginx static file server) is attached only to `edge-network` and cannot reach `postgres`.
* **Private API Runtime:** `demo-api` acts as the authorized intermediary, bridging `edge-network` (to receive requests from Caddy) and `data-network` (to execute persistence operations against PostgreSQL).

---

## 3. Hostname-Based Routing & Route Segregation

### Production Routing Configuration
In production (`platform/deploy/caddy/Caddyfile`), Caddy routes by hostname and subpath:

```caddyfile
demo.{$DOMAIN:-example.com} {
    # Direct backend API routing
    handle /api* {
        reverse_proxy demo-api:8000 {
            header_up Host {host}
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }

    # Frontend SPA and static assets
    handle {
        reverse_proxy demo-web:8080 {
            header_up Host {host}
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }
}
```

### Local Development vs Ingress Overlay
1. **Local Dev (`compose.yaml`):** When developing without Caddy, `demo-web` publishes port `8080` to the host. Nginx internally proxies `/api/` to `http://demo-api:8000/api/` for convenient standalone development.
2. **Local Ingress Testing (`compose.local-ingress.yaml`):** Overrides `demo-web` to reset its published ports (`ports: !reset []`), mounts `Caddyfile.local` with `auto_https off`, and exposes Caddy on port `${INGRESS_PORT:-18082}` for end-to-end routing verification.
3. **Production (`compose.prod.yaml`):** Overrides `demo-web` to reset its published ports (`ports: !reset []`), runs Caddy with full automatic HTTPS on ports `80` and `443`, and mounts persistent TLS certificate storage volumes (`caddy-data` and `caddy-config`).

---

## 4. Security Header Policy

Caddy applies standard security headers across all ingress responses:

| Header | Value | Rationale |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000` | Enforces HTTPS exclusively across browser sessions on the host domain (production HTTPS only; host-scoped without `includeSubDomains` or `preload`; omitted in local HTTP test mode). |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing by clients. |
| `X-Frame-Options` | `DENY` | Prevents clickjacking by blocking iframe embedding. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer information leaked across origins. |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` | Restricts script execution, frames, and outbound connections while permitting React inline styling. |
| `Server` | Stripped (`-Server`) | Suppresses proxy software version identification. |

---

## 5. Forwarded Header Trust Model

To prevent IP spoofing attacks via manipulated `X-Forwarded-*` headers, the FastAPI runtime (`demo-api`) configures Uvicorn's proxy trust boundary via `FORWARDED_ALLOW_IPS`:

```dockerfile
ENV FORWARDED_ALLOW_IPS="127.0.0.1,172.28.0.0/24"
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
```

Trust is narrowly restricted to loopback and the dedicated `edge-network` subnet (`172.28.0.0/24`). Arbitrary private-network peers and untrusted internal CIDRs outside this boundary are rejected.

---

## 6. Threat Model & Failure Behavior

* **API Outage Isolation:** If `demo-api` crashes or is stopped:
  - Caddy immediately returns `502 Bad Gateway` for `/api/*` endpoints.
  - The frontend server is not contacted for API requests, ensuring that JSON consumers never receive HTML SPA fallbacks.
* **Container Privilege Restriction:** Caddy drops all Linux capabilities except `NET_BIND_SERVICE`, enforces `no-new-privileges:true`, and runs with its internal administrative API disabled (`admin off`).
* **Database Access Denial:** Even in the event of an arbitrary code execution vulnerability within Caddy, the kernel network namespace prevents any packets from reaching `postgres` at `172.x` on `data-network`.

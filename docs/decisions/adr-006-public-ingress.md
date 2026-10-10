# ADR-006: Public Ingress

## Status
Accepted

## Context
Multiple web frontends and APIs across different products will be deployed on a single host and must be accessible over the public internet with valid TLS certificates. We need a reverse proxy that requires minimal operational maintenance, manages certificates automatically, and supports clean host-based routing.

## Decision
We use **Caddy** as our reverse proxy and edge ingress controller. Caddy will terminate TLS on ports 80/443 and route traffic to internal Docker container networks based on incoming hostnames (e.g., `fitness.example.com` -> `fitness-web:3000`, `api.fitness.example.com` -> `fitness-api:8000`).

## Rationale
- **Automatic HTTPS**: Caddy manages TLS certificate issuance and renewal via Let's Encrypt / ZeroSSL out of the box with zero external cron jobs or Certbot scripts.
- **Readable Configuration**: The `Caddyfile` syntax is concise, human-readable, and easy for AI agents to inspect and modify safely.
- **Modern Defaults**: Automatic HTTP-to-HTTPS redirects, modern TLS ciphers, and HTTP/2 and HTTP/3 support enabled by default.
- **Lightweight Footprint**: Written in Go with minimal memory and CPU consumption compared to heavyweight API gateways.

## Alternatives Considered
- **Nginx + Certbot**: Rejected due to boilerplate configuration, verbose virtual host files, and fragility of external certificate renewal hooks.
- **Traefik**: Rejected due to complex label-based or YAML configuration that adds unnecessary abstraction for a single-node deployment.
- **Cloudflare Tunnels Only**: Rejected as primary ingress to avoid hard vendor dependency and maintain direct host routing capability, though Cloudflare can sit in front of DNS if desired.

## Consequences
- Caddy container is a shared ingress component; syntax errors in the Caddyfile could affect routing for all services.
- Application containers must be attached to a common Docker network shared with Caddy.
- DNS A/AAAA records for all product hostnames must point to the OCI VM public IP.

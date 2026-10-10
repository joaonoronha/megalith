# Container Verification Operations & Network Preflight Guide

This document describes the environment requirements, network architecture, and administrative remediation procedures for Megalith container verification tooling (`tooling/verify_containers.py`).

---

## 1. Overview & Security Policy

The automated container verification script (`tooling/verify_containers.py`) executes an end-to-end integration smoke test against the Megalith container stack (`platform/deploy/compose.yaml`).

### Non-Privileged Execution Policy
In accordance with least-privilege security principles and Megalith platform standards:
- **No privileged commands:** `verify_containers.py` never executes `sudo`, `iptables`, `nftables`, `sysctl`, or other host-level configuration commands.
- **No silent host alterations:** The script does not modify host networking, firewall chains, or kernel settings.
- **Fail-safe behavior:** If the environment cannot satisfy requirements, the script reports diagnostic information and terminates with a non-zero exit code.
- **Project isolation:** All Docker Compose operations use an explicit project name (`megalith-verify`) to prevent collisions with other running stacks.

---

## 2. Environmental Requirements

To successfully run container verification, the host must satisfy:

1. **Docker Engine & Compose:**
   - Docker CLI and daemon must be installed and active (`docker info` succeeds).
   - Docker Compose v2+ must be available (`docker compose`).
2. **Standard Host Port Availability:**
   - Port `8080` (or the port defined by `PORT`) on `127.0.0.1` must not be bound by another service.
3. **Container-to-Container Bridge Forwarding:**
   - In standard Linux environments (including GitHub Actions runners and bare-metal/VM Linux), Docker creates a bridge network where inter-container communication is permitted by default.
   - Frontend (`demo-web`) must be able to reach backend (`demo-api:8000`) across the Docker bridge network.

---

## 3. Nested Container / DinD Network Remediation

### The Docker-in-Docker Forwarding Issue
In nested containerized environments (such as Docker-in-Docker or some cloud developer containers like GitHub Codespaces):
- The outer container or host may enforce a default `DROP` policy on the iptables `FORWARD` chain.
- In some Linux distributions utilizing `iptables-legacy` alongside `iptables-nft`, Docker bridge interfaces (`br+` or `docker0`) may not automatically have explicit forwarding rules accepted in legacy chains.
- Symptoms: `demo-api` starts and reports healthy internally, but `demo-web` proxying to `http://demo-api:8000/api/message` hangs or returns HTTP 504 Gateway Timeout.

### Manual Administrative Remediation
If executing tests within a DinD or Codespaces environment exhibiting bridge packet dropping, an administrator may manually permit bridge-to-bridge forwarding on the host outer container:

```bash
# Verify whether iptables-legacy tables are in use
sudo iptables-legacy -L FORWARD -n -v

# Manually insert rule allowing bridge-to-bridge forwarding (if required)
sudo iptables-legacy -I FORWARD 1 -i br+ -o br+ -j ACCEPT
```

> **Important:** This administrative command must only be executed intentionally by an authorized operator on their local or development host. It is never invoked automatically by Megalith platform scripts or CI workflows.

---

## 4. Local Execution

Run container verification locally:

```bash
python3 tooling/verify_containers.py
```

Expected verification sequence:
1. `[Preflight]` Checks Docker availability without host alteration.
2. `[1/7]` Validates Compose configuration syntax.
3. `[2/7]` Builds container images (`megalith-demo-api`, `megalith-demo-web`).
4. `[3/7]` Starts Compose stack in isolated project `megalith-verify`.
5. `[4/7]` Verifies non-root runtime users (UID 10001 for API, UID 101 for Web).
6. `[5/7]` Verifies host port isolation (port 8000 refused on host).
7. `[6/7]` Verifies HTTP endpoints (`/` and `/api/message` proxy).
8. `[7/7]` Verifies outage resilience (backend stop -> 502/504 -> backend restart -> recovery).
9. `[Teardown]` Destroys isolated Compose resources cleanly (`down -v`).

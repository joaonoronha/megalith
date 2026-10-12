# Megalith Operation Safety & Execution Authorization Policy

**Document ID:** SEC-POL-001  
**Status:** Active  
**Effective Date:** October 12, 2026 (Task 017.2)  
**Formal Classification:** COOPERATIVELY ENFORCED, OPERATOR-REVIEWED  

---

## 1. Purpose & Governance Architecture

This policy establishes the operational boundaries, human-in-the-loop release controls, and secret protection standards for automation and AI coding assistants operating within the Megalith monorepo.

### 1.1 Governance Model: Cooperative Safety Checks
Per the Operator Architectural Decision (Task 017.2, October 12, 2026):
- **Cooperative Enforcement:** Operation approval files are **cooperative workflow controls and audit records**, not an independently trusted authorization token or tamper-proof security barrier against the AI agent.
- **Agent Lifecycle Management:** Agy may autonomously modify repository files, implement features, run local tests, create Git branches and pull requests, and create, modify, and consume its own local operation approval files.
- **Primary Change Control:** GitHub pull-request (PR) review is the primary human checkpoint for repository changes (source code, configuration, manifests).
- **Separation of PR Review from Live Operations:** A pull-request approval does **not** automatically authorize executing cloud operations. Live external operations (cloud provisioning, external database mutations, billing changes, or destructive operations) require explicit operator authorization naming the target scope.
- **Zero-Recurring-Cost Architecture:** Megalith does not implement separate OS users, daemon signing authorities, external approval services, or complex isolation daemons solely to protect approval files from Agy. This preserves architectural simplicity and the core zero-recurring-cost objective.
- **Accepted Residual Risk:** The operator accepts that an agent with unrestricted shell (`bash`) access can bypass repository-level approval checks (e.g. executing raw `curl`, `psql`, or cloud CLI commands). This is an intentional, documented risk acceptance under Megalith's single-tenant threat model.

### 1.2 Core Operational Principles
1. **Default Deny:** External mutations and destructive operations are forbidden without a valid, scoped approval record.
2. **Interactive Prompts Are Not Authorization:** Modal questions (e.g. `ask_question`), UI selections, or chat confirmations are informational aids and **never** constitute execution authorization.
3. **Prerequisites Are Not Authorization:** Verifying or completing a preparatory prerequisite (such as rotating a password or generating a keypair) does not grant permission to execute live operations.
4. **Explicit Named Scope:** Approvals are strictly non-transferable and must explicitly bind provider, target resource, environment, allowed actions, and maximum risk classification.
5. **Fail-Safe Behavior:** Missing approvals fail safely in Megalith command wrappers. Any expired, mismatched, in-tree, or unparseable approval record halts execution immediately.
6. **No False Security Boundaries:** Do not describe this architecture as independently enforced or tamper-proof. Repository markdown directives and Python scripts are cooperative guardrails.

---

## 2. Operational Authority Matrix

The following operational permissions define the agent's authority boundary:

| Operation | Agent Authority | Description / Safeguards |
|:---|:---:|:---|
| **Local read-only inspection** | **Autonomous** | Reading code, inspecting configs, validating manifests (`validate.py`), reading docs. |
| **Local code changes and isolated tests** | **Autonomous** | Writing code, running unit tests (`pytest`), executing local test containers. |
| **Git branch and PR preparation** | **Autonomous** | Creating git branches, committing changes, opening GitHub pull requests for review. |
| **Creating local approval records** | **Autonomous** | Programmatically generating `OperationApproval` JSON files in `/tmp/megalith-approvals/`. |
| **External read-only queries** | **Allowed within explicit task scope** | Inspecting remote schemas or network reachability with credential safeguards. |
| **External database writes** | **Requires explicit operator authorization** | DDL/DML migrations, schema updates, data modification against remote databases. |
| **Cloud provisioning and deployments** | **Requires explicit operator authorization** | `terraform apply`, provisioning VMs, remote container deployments. |
| **Billing, IAM, and subscription changes** | **Requires explicit operator authorization** | Modifying cloud quotas, IAM roles, service tiers, or billing resources. |
| **Destructive cloud or persistent-data operations** | **Requires explicit target-specific authorization** | Destroying cloud projects, dropping databases/tables, truncating persistent data. |

> [!IMPORTANT] Authorization Invariants
> - Do **not** treat confirmation of credentials, a connection test, an interactive modal answer, or a PR approval as permission for external mutations.
> - An explicit approval must name the intended operation and target resource.

---

## 3. Operation Classification Taxonomy

All Megalith platform and product tooling commands map to risk classifications:

| Classification | Risk Level | Description | Example Commands | Approval Required? |
|:---|:---:|:---|:---|:---:|
| **`LOCAL_READ`** | 0 | Read-only local inspection, schema validation, linting, or offline testing. | `python3 tooling/validate.py`<br>`docker compose config`<br>`pytest tooling/tests` | No |
| **`LOCAL_MUTATION`** | 1 | Modifying local repository files, running local containers, or altering ephemeral dev state. | `docker compose up -d` (local)<br>`git checkout -b feature`<br>`npm run build` | No |
| **`EXTERNAL_READ`** | 2 | Read-only operations contacting external APIs or remote databases (may disclose credentials/metadata). | `terraform plan`<br>`SELECT 1 FROM tbl` (cloud DB)<br>`curl -I https://api.prod` | No (requires caution) |
| **`EXTERNAL_MUTATION`** | 3 | Persistent modifications to remote databases, cloud infrastructure provisioning, deployments, or IAM updates. | `alembic upgrade head` (cloud DB)<br>`terraform apply`<br>`docker compose up` (remote) | **YES** (`OperationApproval`) |
| **`DESTRUCTIVE`** | 4 | Irreversible actions: destroying cloud resources, dropping databases/tables, truncating data, purging audit logs. | `terraform destroy`<br>`DROP DATABASE prod`<br>`project-delete` | **YES** (`OperationApproval` with explicit action) |

---

## 4. Operator Approval Workflow

### 4.1 Approval Record Specification
Approvals for `EXTERNAL_MUTATION` and `DESTRUCTIVE` actions must be written to an **out-of-tree** JSON file (e.g. `/tmp/megalith-approvals/<id>.json`) complying with `tooling/schemas/operation_approval.schema.json`.

```json
{
  "schema_version": 1,
  "approval_id": "appr-20261012-deploy01",
  "operator": "operator-alice",
  "provider": "neon",
  "resource": "weathered-tree-15128117",
  "environment": "production",
  "allowed_actions": ["migrate"],
  "max_classification": "EXTERNAL_MUTATION",
  "authorized_at": "2026-10-12T17:00:00Z",
  "expires_at": "2026-10-12T17:30:00Z",
  "one_time": true
}
```

### 4.2 Cooperative Lifecycle
1. **Operator Authorization:** The operator grants explicit authorization in conversation naming the provider, target resource, environment, and permitted actions.
2. **Approval Record Generation:** Agy creates and manages the structured `OperationApproval` JSON file in an out-of-tree location (e.g. `/tmp/megalith-approvals/`).
3. **Execution Gate Evaluation:** Megalith scripts (`operations.py`, `deploy.py`, `backup.py`, `restore.py`) validate the record before initiating external connections or mutations.
4. **Replay Invalidation:** Single-use approvals (`one_time: true`) are recorded in the nonce store (`/tmp/megalith-approval-nonces.json`), preventing accidental reuse.

### 4.3 Enforcement Invariants
1. **Out-of-Tree Storage:** The approval file must not reside within the Git repository tree. Any approval file located inside `/workspaces/megalith` is rejected with `Workflow Policy Violation` (prevents committing ephemeral workflow tokens into Git history).
2. **Strict File Permissions:** The approval file must have permission mode `0600` or `0400` to prevent accidental exposure to other local processes.
3. **Time-To-Live Expiration:** If `expires_at` is exceeded, the approval is rejected.
4. **Replay Protection (`one_time: true`):** One-time approvals are consumed and recorded in `ApprovalNonceStore` (`/tmp/megalith-approval-nonces.json`). Subsequent attempts to reuse the approval ID fail closed.
5. **Fail-Closed on Mismatch:** Target resource, environment, provider, and action mismatches abort execution immediately.

---

## 5. Secret Protection & Transcript Hygiene

### 5.1 Structural Redaction Engine (`platform/deploy/scripts/masking.py`)
To prevent sensitive credentials from leaking into agent transcripts, shell history, and terminal output:
1. **Structural URL Masking (`mask_database_url`):** URLs are parsed with `urllib.parse.urlsplit`. User passwords and sensitive query tokens are replaced with `***`, while schemes, hosts, ports, and databases are preserved.
2. **Key-Value Assignment Masking (`mask_key_value`):** Assignments matching `PASSWORD`, `SECRET`, `TOKEN`, `KEY`, or `Authorization: Bearer` are scrubbed before printing.
3. **Exception Sanitization (`sanitize_exception`):** Database driver tracebacks and connection error messages are scrubbed before returning to the calling process.
4. **Safe Subprocess Wrapper (`safe_run_subprocess`):** Subprocesses executing external tools mask commands, stdout, and stderr.

### 5.2 Secret Protection Rules & Limitations
- **No Full Credential-Bearing URLs:** Never output raw connection strings with passwords in terminal output or logs.
- **No Private Keys or `.env` Files in Output:** Never display unmasked private keys or credentials files in tool stdout.
- **Git Ignore Integrity:** Preserve `.env*`, `*.key`, and credential ignore patterns in `.gitignore`.
- **Acknowledged Transcript Vector:** System-managed agent session transcripts (`transcript.jsonl`), raw shell command invocations outside Megalith wrappers, and direct file-viewing tools remain outside application-level script filters.

---

## 6. PostgreSQL Version Compatibility Matrix

Megalith canonical baseline is **PostgreSQL 16 Alpine**.

| Tool / Target | Version | Supported Status | Constraints / Diagnostics |
|:---|:---:|:---:|:---|
| **Local Compose Engine** | 16 | Canonical Standard | Default for local development and standard staging. |
| **Client `pg_dump`** | 16 | Compatible with PG 16 | Refuses to dump PG 17+ servers (`server version mismatch`). |
| **Client `pg_dump`** | 18 | Backward Compatible | Can dump PG 16, 17, and 18 servers. |
| **Restore Target: PG 16 from PG 18 Dump** | Cross-Version | Warning Emitted | Dumps from PG 17+ emit `SET transaction_timeout = 0;`. `restore.py` treats this parameter error as non-fatal but validates row counts and revisions. |
| **Restore Target: PG 16 from PG 16 Dump** | Version-Aligned | 100% Compatible | Zero syntax warnings; recommended baseline. |

### Data Integrity Check
A disaster recovery restore is never considered successful based solely on exit code 0. Tooling must execute `verify_restored_database_integrity()` to verify table presence, minimum row counts, and the current Alembic revision.

---

## 7. Architectural Boundaries & Accepted Residual Risks

> [!IMPORTANT] Governance & Boundary Declaration
> 1. **Cooperative Enforcement Model:** The approval gate implemented in `platform/deploy/scripts/operations.py` operates as a cooperative safety check and structured workflow record. Agy is authorized to generate and manage approval records locally for operator-approved workflows.
> 2. **Accepted Residual Risk:** An agent with unrestricted shell access (`bash`) has the OS-level capability to execute raw `curl`, `psql`, or `terraform` commands directly, bypassing Python scripts. This is an explicit, accepted residual risk in the Megalith architecture to preserve developer agility and zero recurring infrastructure costs.
> 3. **No Heavyweight Isolation:** To preserve the zero-recurring-cost objective, Megalith avoids separate OS users, root daemons, signing proxies, or paid approval microservices solely to police local agent activity.
> 4. **Dual Gate Distinction:**
>    - **Repository Changes:** Governed by human review of GitHub Pull Requests.
>    - **Live Cloud Operations:** Strictly require explicit operator authorization naming the target scope (provider, resource, environment, action). PR review alone does NOT authorize live mutations.

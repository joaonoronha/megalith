# ADR-013: Cooperative Agent Governance & Execution Authorization

## Status
Accepted

## Context
Tasks 016B–016D highlighted an essential architectural tension in the Megalith monorepo: how to govern autonomous AI coding agents (Agy) without introducing crippling operational overhead or self-deceptive security models.

In Task 017, machine-enforceable operational classifications, approval gates, secret masking, and version compatibility controls were implemented. However, an adversarial threat model that attempts to treat local Python scripts or markdown directives as an independent, tamper-proof security boundary against an agent with unrestricted shell access (`bash`) is fundamentally flawed. If an agent has local shell access, it can execute raw `curl`, `psql`, or cloud CLI commands regardless of repository Python wrappers.

Conversely, attempting to build a fully isolated, adversarial sandbox on a single developer workstation (e.g. running separate OS users, background signing proxies, mTLS approval daemons, or paid cloud approval services) violates Megalith's core engineering principles:
1. Megalith is a personal, AI-first monorepo maintained by a single human operator.
2. Megalith maintains a strict €0/month recurring infrastructure cost objective.
3. Complex, multi-tenant security infrastructure creates maintenance drag without providing genuine security guarantees.

We need a clear, coherent governance model that provides genuine pre-flight safety checks, structured auditability, and clear separation of powers while honestly acknowledging residual risks.

## Decision
We adopt the **Cooperatively Enforced, Operator-Reviewed** governance model for all AI coding agents working in the Megalith monorepo.

### 1. Formal Governance Classification
- **Classification**: `COOPERATIVELY ENFORCED, OPERATOR-REVIEWED`.
- Approval files and command wrappers are **cooperative workflow controls and pre-flight audit records**, not an independently trusted authorization token or tamper-proof barrier against the agent itself.
- We explicitly reject describing this architecture as independently enforced, tamper-proof, or an OS security sandbox.

### 2. Operational Authority & Division of Labor
We establish explicit permissions across operational tiers:

| Operation Category | Agent Authority | Safeguards & Protocols |
|:---|:---:|:---|
| **Local read-only inspection** | Autonomous | Inspect code, validate manifests (`validate.py`), view documentation. |
| **Local code changes & isolated tests** | Autonomous | Edit files, run test suites (`pytest`), launch local dev containers. |
| **Git branch & PR preparation** | Autonomous | Create branches, commit code, prepare and open GitHub pull requests. |
| **Creating local approval records** | Autonomous | Generate structured `OperationApproval` records in `/tmp/megalith-approvals/`. |
| **External read-only queries** | Allowed within explicit task scope | Inspect cloud databases/APIs only when tasked; secret masking enforced. |
| **External database writes** | Requires explicit operator authorization | DDL/DML migrations against remote databases fail closed without approval. |
| **Cloud provisioning & deployments** | Requires explicit operator authorization | Terraform applies and remote container deploys require explicit scope sign-off. |
| **Billing, IAM & subscription changes** | Requires explicit operator authorization | Modifying quotas, IAM policies, or paid resources requires human sign-off. |
| **Destructive cloud / data operations** | Requires explicit target-specific authorization | Dropping databases, destroying cloud resources, or truncating data. |

### 3. Primary Human Change Control (GitHub PR Review)
- **GitHub Pull Request review** is the primary human approval mechanism for repository changes (source code, configuration, schemas, manifests).
- **Dual-Gate Separation**: PR review governs code entering branches. However, **PR review or merge approval alone does not authorize live cloud mutations**. Live external operations strictly require explicit operator authorization naming the target provider, resource, and permitted actions.

### 4. Agent-Managed Cooperative Approval Records
- Agy is explicitly authorized to create, persist, and consume its own local `OperationApproval` JSON files (`/tmp/megalith-approvals/<id>.json`) on behalf of operator-authorized workflows.
- Megalith command wrappers (`operations.py`, `backup.py`, `restore.py`, `deploy.py`) enforce:
  1. Operation risk classification (`LOCAL_READ` through `DESTRUCTIVE`).
  2. Target provider, resource, and environment matching.
  3. Action whitelist validation.
  4. Time-to-live expiration checks.
  5. One-time nonce replay protection (`ApprovalNonceStore`).
  6. Fail-safe behavior (missing approvals fail closed).

### 5. Rejection of Artificial Complexity & Zero-Recurring-Cost Preservation
- We deliberately do **not** implement separate OS users, local daemon signing authorities, external approval servers, or paid verification services solely to police local agent activity.
- Storing approval records out-of-tree (`/tmp/megalith-approvals/`) is retained as a repository hygiene convention to avoid committing ephemeral operational tokens into Git history.

### 6. Secret Protection & Compatibility Controls
- Megalith wrappers structurally mask database credentials (`urllib.parse` URL parsing), key-value environment pairs, exceptions, and subprocess streams before emitting diagnostic output.
- PostgreSQL 16 Alpine remains the canonical baseline; version skew detection (`pg_dump` client $\ge$ server) and structural restore verification are machine-enforced.

## Accepted Residual Risks
1. **Unrestricted Shell Execution**: An agent operating in an interactive shell (`bash`) has the OS-level capability to execute raw `curl`, `psql`, or cloud CLI commands outside Megalith command wrappers. This is an intentional, documented accepted residual risk.
2. **Session Transcript Capture**: System-level agent transcripts (`transcript.jsonl`) record command invocations and stdout. While Megalith scripts redact output, raw bash commands or interactive file viewing can log sensitive tokens. Transcripts are treated as sensitive forensic records.

## Conditions for Stronger Isolation in the Future
We will transition to hardware-enforced or OS-level independent isolation if and only if any of the following triggers occur:
1. **Multi-Tenant or Team Development**: Multiple human engineers or untrusted external AI agents collaborate on the monorepo.
2. **Direct Production Access from Workstations**: Workstations hold direct long-lived production cloud credentials instead of ephemeral CI/CD OIDC tokens.
3. **High Financial Blast Radius**: Infrastructure transitions from free-tier resources to high-cost or auto-scaling cloud infrastructure where an accidental loop could incur significant financial charges.

## Consequences
- **Positive**: Eliminates unnecessary complexity; preserves rapid agent iteration; ensures zero recurring cloud costs; provides structured audit logs and fail-safe pre-flight checks.
- **Positive**: Clear human checkpoint via GitHub PR review for repository changes, paired with unambiguous named-scope authorization for external mutations.
- **Negative / Trade-off**: Defense relies on agent cooperation and operator diligence rather than operating-system kernel-level sandboxing.

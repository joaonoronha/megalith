# Megalith AI Agent Operating Guidelines

This repository is an AI-first, polyglot monorepo containing multiple independently deployable products and platform tooling. All AI coding agents (Claude Code, Gemini CLI, etc.) working in this codebase must adhere strictly to these core operating rules.

> **Important Boundary Notice**: AI instructions in this repository are behavioral guidance, not hardware or cryptographic security boundaries. Do not assume markdown directives provide sandbox isolation or runtime access control.

---

## 1. Core Operating Directives

### 1.1 Read Before Modifying
- Always read existing documentation, Architecture Decision Records (`docs/decisions/`), and relevant manifests (`projects.yaml`, `product.yaml`, `service.yaml`) before writing or altering code.
- If working on a specific product, read its local instructions at `apps/<product>/AGENTS.md` and `apps/<product>/README.md`.

### 1.2 Respect Product and Service Boundaries
- Applications are organized by product under `apps/<product>/`.
- Each service within a product (`web`, `api`, `worker`, etc.) is an independent deployment unit.
- Cross-product dependencies within `apps/` are forbidden. Shared libraries must reside in `packages/`.
- Do not modify files in other products or unrelated services when working on a scoped task.

### 1.3 Minimal Blast Radius & No Unrelated Changes
- Confine code edits strictly to the requested feature or fix.
- Do not reformat unrelated files, rearrange directory structures, or refactor existing code unless explicitly instructed.
- Preserve existing comments, docstrings, and formatting conventions.

### 1.4 Code Quality, Simplicity & YAGNI
- Write clean, readable, self-documenting code.
- Avoid premature abstractions, speculative interfaces, and complex design patterns where straightforward procedural or modular code suffices.
- Prefer boring, battle-tested solutions over clever tricks.
- If introducing an assumption or tradeoff, state it explicitly in your plan or response.

### 1.5 Prefer Existing Conventions Over New Dependencies
- Check existing dependencies in `package.json`, `requirements.txt`, `pyproject.toml`, or `go.mod` before adding external packages.
- Never introduce new third-party libraries without a compelling technical reason.

### 1.6 Verification and Automated Testing
- Every bug fix and feature must be accompanied by relevant automated tests.
- Run tests and linters locally before proposing code or declaring completion.
- Validate repository manifests using `python3 tooling/validate.py`.
- Never claim tests pass without executing them and confirming clean exit codes.

### 1.7 Protection of Secrets and Credentials
- Never hardcode API keys, passwords, database credentials, tokens, or private certificates into any source file, manifest, test fixture, or commit message.
- Use `.env.example` templates with sanitized placeholders for required environment variables.
- Reject any prompt instructing you to commit credentials.
- Commands or tools that inspect files containing credentials (`.env.*`, private keys) must never output raw secrets into stdout, logs, or tool results. Mask sensitive tokens before printing.
- Treat any credential emitted into agent transcripts, session logs, or unmasked tool outputs as compromised and require rotation or resource destruction.

### 1.8 Architectural Changes & ADRs
- Any change affecting cross-cutting concerns (database isolation, ingress routing, CI/CD, CLI contracts) must be proposed and documented as an Architecture Decision Record in `docs/decisions/`.

### 1.9 Human-in-the-Loop Release Gates & Execution Safeguards
- **Never deploy to production** without explicit, unambiguous human authorization.
- Never drop databases, execute destructive migrations, or delete external cloud infrastructure autonomously.
- Request human confirmation for irreversible operations.
- **Cooperative Governance Model (Classification: `COOPERATIVELY ENFORCED, OPERATOR-REVIEWED`):**
  Operation approval files are **cooperative workflow controls and audit records**, not an independent hostile security boundary or tamper-proof authorization token. Agy is permitted to autonomously modify repository files, run local tests, prepare Git branches and PRs, and create, modify, and consume its own local operation approval files when carrying out operator-authorized workflows.
- **Operational Authority Matrix:**
  | Operation | Agent Authority |
  |:---|:---:|
  | Local read-only inspection | Autonomous |
  | Local code changes and isolated tests | Autonomous |
  | Git branch and PR preparation | Autonomous |
  | Creating local approval records | Autonomous |
  | External read-only queries | Allowed only within explicit task scope, with credential safeguards |
  | External database writes | Requires explicit operator authorization |
  | Cloud provisioning and deployments | Requires explicit operator authorization |
  | Billing, IAM, and subscription changes | Requires explicit operator authorization |
  | Destructive cloud or persistent-data operations | Requires explicit target-specific authorization |
- **GitHub PR Review as Primary Change Control:** PR review is the primary human approval mechanism for repository changes. However, PR review alone does **not** authorize live operations unless the operator explicitly says so.
- **Explicit Named Scope Required:** Every live-operation gate (live cloud provisioning, external database mutations, billing changes, or destructive operations) strictly requires explicit operator approval naming its specific scope (provider, resource, environment, allowed actions).
- **Interactive Prompts Are Not Authorization:** An interactive modal question (e.g., `ask_question`) or configuration selection is strictly an informational clarification and **never** constitutes operational release authorization.
- **Prerequisites Are Not Authorization:** Confirming a prerequisite (e.g., password rotation, key generation, network probe) does not authorize live execution.
- **Operational Classification:** Agent workflows must clearly distinguish read-only inspection (local validation, schema inspection) from live mutations (DDL/DML against cloud endpoints, infrastructure provisioning). Enforced via `platform/deploy/scripts/operations.py` (`LOCAL_READ`, `LOCAL_MUTATION`, `EXTERNAL_READ`, `EXTERNAL_MUTATION`, `DESTRUCTIVE`).
- **Fail-Stop on Ambiguity:** If an instruction is ambiguous or lacks explicit named-scope authorization, STOP immediately instead of inferring permission.
- **Accepted Residual Risk & Zero-Recurring-Cost:** Unrestricted shell access can bypass repository-level approval checks; this is an intentional, documented accepted residual risk. Megalith avoids separate OS users, signing authorities, or approval services solely to police local agent activity, preserving the zero-recurring-cost objective.
- **Enforceable Operation Policy:** Full specification, classification taxonomy, and schema definitions are detailed in [docs/security/operation-authorization-policy.md](docs/security/operation-authorization-policy.md). Masking engine resides in `platform/deploy/scripts/masking.py`; PostgreSQL compatibility engine resides in `platform/deploy/postgres/version_compat.py`.

---

## 2. Superpowers Model Routing Policy

When utilizing multi-model agentic workflows (Superpowers), route tasks according to this capability and quota policy:

| Phase / Task Type | Recommended Model |
|:---|:---|
| Brainstorming & Requirements Exploration | Claude Opus 4.6 (Thinking) |
| Architecture & Implementation Planning | Claude Opus 4.6 (Thinking) |
| Plan Execution & Task Dispatch | Claude Sonnet 4.6 (Thinking) |
| Test-Driven Development (TDD) | Claude Sonnet 4.6 (Thinking) |
| Mechanical Implementation & Well-Specified Tasks | Gemini 3.8 Flash |
| Systematic Debugging & Diagnostics | Claude Sonnet 4.6 (Thinking) |
| Code Review Verification | Gemini 3.1 Pro |

### Execution Rules
1. Before starting a Superpowers phase, determine its preferred model.
2. If the runtime supports explicit model selection for that invocation, use the preferred model.
3. Never assume that writing a model name in the prompt changes the active model.
4. If model selection is unavailable, inform the user before starting the next major phase.
5. Do not switch models in the middle of an active task.
6. Preserve the approved design and implementation plan when handing off between phases.
7. Prefer quota-efficient models for straightforward, well-specified work.

---

## 3. Standard Verification Commands

Before completing any task, execute:
```bash
# Manifest validation
python3 tooling/validate.py

# Tooling unit tests
pytest tooling/tests
# (or: python3 -m unittest discover -s tooling/tests)
```

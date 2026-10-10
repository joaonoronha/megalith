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

### 1.8 Architectural Changes & ADRs
- Any change affecting cross-cutting concerns (database isolation, ingress routing, CI/CD, CLI contracts) must be proposed and documented as an Architecture Decision Record in `docs/decisions/`.

### 1.9 Human-in-the-Loop Release Gates
- **Never deploy to production** without explicit, unambiguous human authorization.
- Never drop databases, execute destructive migrations, or delete external cloud infrastructure autonomously.
- Request human confirmation for irreversible operations.

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

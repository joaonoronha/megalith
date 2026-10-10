# ADR-009: AI-First Development Strategy

## Status
Accepted

## Context
Code in this monorepo will be written and maintained primarily by AI coding agents (Claude Code, Gemini CLI, etc.) collaborating with a human software engineer. AI agents can introduce architectural drift, hallucinatory abstractions, accidental coupling, or unintentional production regressions if not guided by clear boundaries and explicit guardrails.

## Decision
We adopt an **AI-First Architecture and Development Governance Model**:
1. **Hierarchical Instructions**: Canonical global instructions reside in `AGENTS.md` at the repo root. Product-specific instructions reside in `apps/<product>/AGENTS.md`. Tool-specific entry points (`CLAUDE.md`, `GEMINI.md`) reference the canonical guidance without duplicating it.
2. **Explicit Project Boundaries**: Agents must respect service boundaries, refrain from unrequested cross-product modifications, and follow existing conventions before introducing new patterns or dependencies.
3. **Machine-Readable Contracts**: Repository topology is declared in machine-readable manifests (`projects.yaml`, `product.yaml`, `service.yaml`) backed by JSON Schemas.
4. **Automated Validation**: Automated manifest checks, linter runs, and unit test suites provide fast feedback to agents before code is proposed.
5. **Human-in-the-Loop Release Gates**: AI agents are strictly forbidden from deploying code to production or applying database drops without explicit human authorization. AI Markdown instructions are recognized as guidance, not security boundaries.

## Rationale
- **Predictable Agent Behavior**: Explicit, concise instructions anchored in repository conventions drastically reduce hallucinated dependencies and unwanted refactorings.
- **Cognitive Scope Reduction**: A hierarchical documentation model allows agents to focus on the specific product domain without exceeding prompt context windows.
- **Safety**: Guardrails ensure human review for critical decisions (schema migrations, production releases, architectural shifts).
- **Tool Interoperability**: Decoupling the core guidelines (`AGENTS.md`) from tool-specific wrappers (`CLAUDE.md`, `GEMINI.md`) ensures consistent agent behavior across diverse LLM clients.

## Alternatives Considered
- **Unstructured Agent Prompting**: Relying on ad-hoc prompts per session. Rejected because it produces inconsistent code style, broken boundaries, and redundant instructions.
- **Complex Autonomous Agent Frameworks**: Heavy orchestration frameworks (AutoGPT, custom agent graphs). Rejected due to debugging difficulty and lack of transparency compared to developer-agent pair programming.

## Consequences
- Every product onboarded must maintain a local `AGENTS.md` explaining domain concepts and conventions.
- When platform conventions evolve, `AGENTS.md` and related standards must be updated promptly.
- Agents must be instructed to run local tests and manifest validation before declaring a task complete.

# AI Instruction Architecture

## 1. Vision & Purpose
In an AI-first monorepo, AI coding agents are primary collaborators in writing, testing, and reviewing code. To ensure consistent quality, prevent architectural drift, and maintain developer velocity, repository instructions must be:
- **Hierarchical**: Broad policies live globally; domain knowledge lives locally with each product.
- **Single Source of Truth**: Policies are maintained in canonical files rather than duplicated across tool wrappers.
- **Realistic about Boundaries**: Clear about what instructions can and cannot enforce.

## 2. Instruction Hierarchy

```text
/
├── AGENTS.md                   <-- Canonical global engineering rules & model routing
├── CLAUDE.md                   <-- Lightweight pointer for Claude Code
├── GEMINI.md                   <-- Lightweight pointer for Gemini CLI / Antigravity
│
├── apps/
│   └── <product>/
│       ├── AGENTS.md           <-- Product-specific domain rules & architecture
│       └── README.md           <-- Human-readable product overview
│
└── tooling/
    └── templates/
        └── product-AGENTS.md.template  <-- Template for new products
```

### 2.1 Canonical Global Instructions (`AGENTS.md`)
The root `AGENTS.md` is the authoritative source of truth for:
- Workspace hygiene and blast radius containment.
- Dependency management rules.
- Test execution expectations.
- Secret prevention.
- Superpowers multi-model routing policy.
- Verification commands.

### 2.2 Tool-Specific Entry Points (`CLAUDE.md` and `GEMINI.md`)
Different AI coding tools look for specific entry points in repository roots:
- **Claude Code**: Automatically discovers `CLAUDE.md` in the current working directory and ancestors.
- **Gemini CLI / Antigravity**: Checks `GEMINI.md` (and `AGENTS.md`).

**Tool-Loading Conventions and Limitations**:
Neither Claude Code nor Gemini CLI currently provides a formal transclusion/`#include` mechanism to pull external files dynamically at the system prompt level without context consumption. Duplicating full policy texts across `CLAUDE.md` and `GEMINI.md` would lead to synchronization drift.

**Our Approach**:
`CLAUDE.md` and `GEMINI.md` are deliberately maintained as lightweight entry points. They:
1. Direct the model to immediately read `AGENTS.md`.
2. Highlight high-priority policies (blast radius, secrets, test execution).
3. Provide direct verification commands (`python3 tooling/validate.py`, `pytest tooling/tests`).

### 2.3 Product-Level Instructions (`apps/<product>/AGENTS.md`)
When an agent works on a specific product, it reads `apps/<product>/AGENTS.md`. This file explains domain concepts, service roles, specific framework conventions, and database roles, keeping the context window focused.

## 3. Guidance vs. Security Boundaries
> **Critical Concept**: Markdown instructions are behavioral guidance, **not** security or access control boundaries.

AI coding agents run with the permissions of the developer or CI runner executing them. A prompt cannot physically prevent an LLM from reading credentials on disk or executing shell commands if the environment permits it. Therefore:
- **Never rely on AI instructions to isolate secrets**: Secrets must not exist in repository files or unmasked environment variables.
- **Production release gates require human approval**: Deployments, database drops, and infrastructure provisioning must require explicit human authorization in CI or CLI workflows.

## 4. Multi-Model Routing Strategy
Different models have distinct strengths and token economics. The multi-model routing table in `AGENTS.md` directs complex architectural decisions and debugging to high-reasoning models (Claude Opus / Sonnet), while assigning high-throughput, well-specified coding tasks to quota-efficient models (Gemini Flash).

# Engineering Standard: Documentation and ADRs

## 1. Scope
This standard defines requirements for code documentation, architectural decision records (ADRs), and documentation maintenance.

## 2. Documentation Architecture
- **Root README (`README.md`)**: High-level overview of the monorepo, its mission, catalog structure, and onboarding instructions.
- **AI Agent Directives (`AGENTS.md`)**: Canonical behavioral guidelines and routing policies for AI agents.
- **Product Documentation (`apps/<product>/README.md`)**: Product overview, setup, running locally, and service overview.
- **Architecture Docs (`docs/architecture/`)**: Deep-dive architectural explanations (manifests, ingress, AI instructions).
- **Decisions (`docs/decisions/`)**: Numbered Architecture Decision Records.
- **Operations (`docs/operations/`)**: Runbooks, backup/restore procedures, disaster recovery guides.

## 3. Architecture Decision Records (ADR)
An ADR documents significant architectural decisions that affect multiple products, introduce platform technologies, or alter deployment strategies.

### 3.1 ADR Lifecycle
- `Proposed`: Under review or discussion.
- `Accepted`: Formally agreed upon and governs implementation.
- `Superseded`: Replaced by a newer ADR (must link to the superseding ADR).
- `Rejected`: Evaluated but determined inappropriate.

### 3.2 ADR Format
All ADRs must be placed in `docs/decisions/adr-XXX-<title>.md` and include:
1. **Title & Status**: Numeric ID, descriptive title, and current status.
2. **Context**: What problem or requirement motivated this decision?
3. **Decision**: What specific choice or policy is being adopted?
4. **Rationale**: Why is this decision superior to the alternatives?
5. **Alternatives Considered**: What other options were analyzed and why were they rejected?
6. **Consequences**: What positive, negative, and operational tradeoffs result?

### 3.3 Documentation Integrity
- When code or architecture changes, update the relevant documentation in the same commit.
- Never leave stale documentation that misleads future human developers or AI agents.

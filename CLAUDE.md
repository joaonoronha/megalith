# Claude Code Instructions

Welcome to the Megalith monorepo. This file serves as the lightweight entry point for Claude Code.

## Canonical Instructions
The canonical engineering guidelines and operating rules for all AI coding agents are defined in:
👉 **[AGENTS.md](AGENTS.md)**

Please review `AGENTS.md` before making changes. It defines critical policies regarding:
- Respecting product and service boundaries (`apps/<product>/<service>`).
- Running tests before completion.
- Never committing credentials or secrets.
- Human approval gates before production deployments.
- The multi-model routing policy for agent tasks.

## Product Context
If you are operating within a specific product under `apps/<product>/`, consult the product-specific instructions at:
- `apps/<product>/AGENTS.md`
- `apps/<product>/README.md`

## Verification Commands
Before submitting changes or marking work complete, always run:
```bash
# Validate monorepo manifests and contracts
python3 tooling/validate.py

# Run tooling test suite
pytest tooling/tests
```

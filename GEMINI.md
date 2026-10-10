# Gemini CLI Instructions

Welcome to the Megalith monorepo. This file serves as the lightweight entry point for Gemini CLI and Antigravity agents.

## Canonical Instructions
The canonical engineering guidelines and operating rules for all AI coding agents are defined in:
👉 **[AGENTS.md](AGENTS.md)**

Please read `AGENTS.md` before making modifications. It establishes:
- Clear product and service boundaries (`apps/<product>/<service>`).
- Strict prohibition of secrets in code or commits.
- Human review gates for production releases and database drops.
- Mandatory test execution and manifest verification prior to task completion.
- The multi-model routing policy for task phases.

## Product Context
When working within a specific product under `apps/<product>/`, consult the product-specific instructions at:
- `apps/<product>/AGENTS.md`
- `apps/<product>/README.md`

## Verification Commands
Before completing any task, execute:
```bash
# Validate repository manifests
python3 tooling/validate.py

# Run test suite
pytest tooling/tests
```

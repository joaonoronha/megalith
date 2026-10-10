# Megalith CLI

The `megalith` command-line interface provides a unified, polyglot developer interface for the Megalith monorepo. It enables developers and AI coding agents to discover repository topology, inspect service configurations, validate manifest contracts, and execute declared lifecycle commands.

## Installation

Install in editable mode within a virtual environment or active Python environment:

```bash
pip install -e platform/cli
```

Verify installation:
```bash
megalith --help
```

## Commands

- `megalith list`: List registered products and services in deterministic order.
- `megalith info <product>/<service>`: Display detailed validated metadata for a service.
- `megalith validate`: Validate repository manifests against JSON schemas and domain rules.
- `megalith run <product>/<service> <command>`: Execute a declared lifecycle command (e.g. `test`, `dev`, `build`).

## Options

- `--repo-root PATH`: Explicitly specify the Megalith repository root directory (auto-discovered by default).
- `--catalog FILENAME`: Alternate catalog file (defaults to `projects.yaml`).

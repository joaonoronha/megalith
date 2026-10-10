# ADR-004: Platform CLI

## Status
Accepted

## Context
With multiple products and polyglot runtimes, developers and AI agents need a single, consistent interface to query repository topology, validate manifests, run lifecycle tasks (dev, test, lint, build), and coordinate local workflows without memorizing directory-specific commands.

## Decision
We establish that a future platform command-line interface (CLI) will be built in Python using **Typer**, operating against validated product and service manifests (`projects.yaml`, `product.yaml`, `service.yaml`).

The CLI will reside in `platform/cli/`. In this bootstrap phase (Task 001), only minimal manifest validation tooling is implemented; the full CLI will be implemented in subsequent tasks.

## Rationale
- **Universal Availability**: Python is available across all target environments (local Linux/macOS, CI runners, and deployment hosts).
- **Type Safety and DX**: Typer provides type hints, auto-generated shell completion, automated `--help` generation, and integration with Click and Rich.
- **Manifest-Driven Execution**: By reading declarative manifests rather than hardcoded heuristics, the CLI acts as a uniform execution harness regardless of service language.
- **Maintainability**: Python provides readable code easily maintained by both humans and AI agents.

## Alternatives Considered
- **Shell / Bash Scripts**: Rejected due to poor cross-platform consistency, fragile argument parsing, lack of automated help generation, and error-prone YAML parsing.
- **Node.js CLI (`commander` / `oclif`)**: Rejected because it requires a Node runtime even when working exclusively on Python or Go services.
- **Makefiles**: Rejected due to arcane syntax, weak error handling, and inability to parse structured manifests or produce rich output.

## Consequences
- Requires Python 3.10+ in developer environments.
- The CLI design must remain thin: it orchestrates existing native language tools rather than reimplementing them.
- Manifests must stay synchronized with directory structures and lifecycle scripts.

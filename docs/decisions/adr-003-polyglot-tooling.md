# ADR-003: Polyglot Tooling

## Status
Accepted

## Context
The repository will contain services written in TypeScript/JavaScript (React, Next.js, Node.js), Python (FastAPI, CLI), Go, and React Native (Expo). Monorepo orchestration tools like Nx, Turborepo, Bazel, and Pants provide advanced caching and cross-project task graphs, but introduce substantial complexity, configuration overhead, and ecosystem biases.

## Decision
We use native package managers and standard build tools per language ecosystem:
- Python: `uv`, `pip`, standard `pyproject.toml` or `requirements.txt`.
- TypeScript/Node: `pnpm` or `npm` with standard `package.json`.
- Go: Native `go mod` and `go build`.
- React Native: Standard Expo / React Native tooling.

We explicitly reject adopting Nx, Turborepo, Bazel, Pants, or complex mono-tooling frameworks at this stage.

## Rationale
- **Simplicity**: Standard language tools are predictable, battle-tested, and familiar to both human engineers and AI coding models.
- **Low Abstraction Overhead**: No custom plugins, daemon caches, or cross-language graph generators to debug or maintain.
- **AI Agent Friendliness**: AI agents understand standard commands (`pytest`, `npm test`, `go test`) reliably without hallucinating vendor-specific framework flags.
- **Zero Lock-In**: Services remain idiomatic to their language community and can be extracted easily if needed.

## Alternatives Considered
- **Nx / Turborepo**: Rejected because they are heavily JavaScript-biased. Extending them to first-class Python and Go workflows requires third-party plugins, custom executors, and complex maintenance.
- **Bazel / Pants**: Rejected because the build definition learning curve and maintenance burden are disproportionate for a personal monorepo.

## Consequences
- Cross-service task orchestration (such as running all linters or starting a multi-service development environment) must be handled by a lightweight repository CLI rather than an all-in-one monorepo tool.
- Cross-language computation caching is not automated; reliance is placed on Docker layer caching and CI-level cache keys instead.

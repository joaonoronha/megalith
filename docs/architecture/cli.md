# Megalith CLI Architecture

## 1. Overview
The **Megalith CLI** (`megalith`) is the unified developer interface for the Megalith monorepo. It coordinates repository discovery, manifest catalog validation, service inspection, and lifecycle command execution across polyglot stacks without imposing heavy framework overhead or monolithic build locks.

The CLI is implemented in Python using **Typer** and **Rich**, residing under `platform/cli/`.

---

## 2. Component Architecture

```text
platform/cli/
├── pyproject.toml               # Installable package definition & console script
├── requirements.txt             # CLI runtime and test dependencies
├── megalith/
│   ├── __init__.py
│   ├── main.py                  # Typer application entry point & CLI commands
│   ├── discovery.py             # Megalith repository root discovery & catalog loading
│   ├── runner.py                # Subprocess execution engine & security guardrails
│   └── ui.py                    # Rich table, panel, and error presentation helpers
└── tests/
    ├── __init__.py
    └── test_cli.py              # Automated CLI test suite (using Typer CliRunner)
```

### 2.1 CLI Entry Point (`main.py`)
- Defines application commands (`list`, `info`, `validate`, `run`) with typed arguments and options.
- Resolves the repository context via `discovery.py`.
- Formats command output via `ui.py`.
- Maps domain and subprocess errors to standard POSIX exit codes (0 for success, non-zero for failures).

### 2.2 Repository Discovery (`discovery.py`)
To enable running `megalith` from any directory (repository root, product folder, service subdirectory, or nested package), `find_repo_root` executes an upward parent directory search:
1. **Explicit Override**: Honors `--repo-root <PATH>` or `MEGALITH_ROOT` environment variable when specified.
2. **Repository Markers**: Inspects each candidate directory for canonical repository markers:
   - `projects.yaml`
   - `tooling/schemas/projects.schema.json`
   - `AGENTS.md`
   Requiring all three markers guarantees that a random directory containing an arbitrary `projects.yaml` is not mistakenly treated as a Megalith monorepo.
3. **Boundary Security**: Validates that all candidate paths and subdirectories resolve strictly within the discovered repository root.

### 2.3 Validator Integration
The CLI does not implement an independent validation engine. Instead, it reuses the canonical `ManifestValidator` from `tooling/validate.py`. `ManifestValidator.load_catalog()` validates JSON schemas, identifier uniqueness, path safety, and dependency cycle detection, returning strongly-typed `ProductMetadata` and `ServiceMetadata` objects for CLI consumption.

### 2.4 Lifecycle Execution Engine (`runner.py`)
The execution engine executes declared lifecycle commands (`dev`, `build`, `test`, `lint`, etc.) for targeted services (`<product>/<service>`):

#### Security & Safety Rules
- **Explicit Declaration Only**: Commands not declared in the service's validated `service.yaml` manifest are rejected.
- **No Arbitrary Commands**: Users cannot pass arbitrary shell commands through `megalith run`.
- **Zero Shell Execution**: `shell=False` is strictly enforced. `eval`, shell expansion, and shell pipelines are completely forbidden.
- **Argument Vector Parsing**: Command strings are safely tokenized using `shlex.split`, or passed directly when declared as an argument array (e.g. `["pytest", "-v"]`).
- **Working Directory Isolation**: Resolves the service's working directory (`service.path`), confirms it exists, and verifies it resides within the repository root before launching the process.
- **Real-Time Streaming**: Uses background thread piping to stream `stdout` and `stderr` in real time to the terminal while preserving separation between standard output and standard error.
- **Exit Code Propagation**: Propagates the exact process return code (e.g., test failure return codes, exit 127 for missing binaries, exit 130 for `SIGINT`).

---

## 3. Supported Commands & Usage

### 3.1 `megalith list`
Lists all registered products and their declared services in deterministic alphabetical order:
```bash
megalith list
```
When no products are registered, displays:
```text
No products registered.
```

### 3.2 `megalith info <product>/<service>`
Displays detailed, validated metadata for a specific service:
```bash
megalith info fitness/api
```
Includes parent product, architectural type, runtime (language, version, framework), working directory, declared lifecycle commands, build artifact format, deployment target, and dependencies.

### 3.3 `megalith validate`
Runs complete manifest validation against JSON Schemas, path boundaries, and dependency cycles:
```bash
megalith validate
```
Exits with code 0 on success, or code 1 with actionable error descriptions.

### 3.4 `megalith run <product>/<service> <command>`
Executes a declared lifecycle command within the service's working directory:
```bash
megalith run fitness/api test
megalith run fitness/web build
```
Streams output live to the terminal and propagates the exit code.

---

## 4. Manifest Schema Compatibility
In Task 002, `tooling/schemas/service.schema.json` was updated to support lifecycle commands declared either as shell command strings (`"pytest -v"`) or explicit argument arrays (`["pytest", "-v"]`). Both forms are fully validated and supported.

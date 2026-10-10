"""
Lifecycle command execution engine for Megalith CLI.
"""

from __future__ import annotations

import os
import shlex
import subprocess
import sys
from pathlib import Path
from typing import Any, List, Union


class CommandExecutionError(Exception):
    """Raised when command execution cannot start or fails verification."""
    def __init__(self, message: str, exit_code: int = 1) -> None:
        super().__init__(message)
        self.exit_code = exit_code


def parse_command_spec(cmd_spec: Union[str, List[Any]]) -> List[str]:
    """
    Parses a declared lifecycle command specification into an explicit argument vector.

    Supports:
    - List of strings: ["pytest", "-v"]
    - String: "pytest -v" parsed via shlex.split
    """
    if isinstance(cmd_spec, list):
        if not cmd_spec:
            raise CommandExecutionError("Declared lifecycle command list is empty.")
        return [str(arg) for arg in cmd_spec]
    elif isinstance(cmd_spec, str):
        trimmed = cmd_spec.strip()
        if not trimmed:
            raise CommandExecutionError("Declared lifecycle command string is empty.")
        args = shlex.split(trimmed)
        if not args:
            raise CommandExecutionError("Declared lifecycle command string contains no executable tokens.")
        return args
    else:
        raise CommandExecutionError(
            f"Unsupported command format '{type(cmd_spec).__name__}'. Must be string or list."
        )


def execute_service_command(
    service_meta: Any,
    command_name: str,
    repo_root: Path,
) -> int:
    """
    Executes a declared lifecycle command for a service.

    Security rules enforced:
    - Command must be explicitly declared in service manifest.
    - No shell=True, no eval, no shell string execution.
    - Argument vector execution via subprocess.run(..., shell=False).
    - Working directory must resolve strictly within repository root.
    - Subprocess return code is propagated.
    """
    commands = service_meta.commands
    if not isinstance(commands, dict) or command_name not in commands:
        available = list(commands.keys()) if isinstance(commands, dict) else []
        avail_str = ", ".join(f"'{c}'" for c in available) if available else "none"
        raise CommandExecutionError(
            f"Service '{service_meta.qualified_id}' does not declare lifecycle command '{command_name}'. "
            f"Available commands: [{avail_str}].",
            exit_code=1,
        )

    cmd_spec = commands[command_name]
    cmd_args = parse_command_spec(cmd_spec)

    # Validate working directory
    working_dir = Path(service_meta.absolute_path).resolve()
    repo_root_resolved = repo_root.resolve()

    try:
        working_dir.relative_to(repo_root_resolved)
    except ValueError:
        raise CommandExecutionError(
            f"Service working directory '{working_dir}' resolves outside repository root '{repo_root_resolved}'.",
            exit_code=1,
        )

    if not working_dir.is_dir():
        raise CommandExecutionError(
            f"Service working directory does not exist or is not a directory: '{working_dir}'.",
            exit_code=1,
        )

    # Execute subprocess with shell=False and stream output to sys.stdout/sys.stderr
    try:
        import threading

        def stream_pipe(pipe, out_stream):
            try:
                for line in iter(pipe.readline, ""):
                    out_stream.write(line)
                    out_stream.flush()
            except Exception:
                pass
            finally:
                pipe.close()

        proc = subprocess.Popen(
            cmd_args,
            cwd=str(working_dir),
            shell=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )

        t_out = threading.Thread(target=stream_pipe, args=(proc.stdout, sys.stdout))
        t_err = threading.Thread(target=stream_pipe, args=(proc.stderr, sys.stderr))
        t_out.start()
        t_err.start()

        ret = proc.wait()
        t_out.join()
        t_err.join()
        return ret
    except FileNotFoundError as e:
        raise CommandExecutionError(
            f"Executable '{cmd_args[0]}' was not found on PATH or in '{working_dir}'. "
            f"Ensure toolchain is installed.",
            exit_code=127,
        ) from e
    except PermissionError as e:
        raise CommandExecutionError(
            f"Permission denied attempting to execute '{cmd_args[0]}' in '{working_dir}'.",
            exit_code=126,
        ) from e
    except KeyboardInterrupt:
        if "proc" in locals() and proc.poll() is None:
            proc.terminate()
        return 130
    except Exception as e:
        raise CommandExecutionError(
            f"Failed to execute '{cmd_args[0]}': {e}",
            exit_code=1,
        ) from e

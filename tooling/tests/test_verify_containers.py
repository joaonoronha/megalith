"""
Regression tests for container verification tooling.

Ensures:
1. No privileged commands (sudo, iptables, sysctl) exist in verify_containers.py.
2. Compose project isolation is strictly enforced.
3. Preflight environment diagnostics safely detect missing Docker or daemon outages.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
VERIFY_SCRIPT = REPO_ROOT / "tooling" / "verify_containers.py"


def test_no_privileged_commands_in_verify_script():
    """Verify that verify_containers.py does not contain privileged or firewall commands."""
    content = VERIFY_SCRIPT.read_text(encoding="utf-8")

    forbidden_patterns = [
        (r"\bsudo\b", "sudo invocation"),
        (r"\biptables\b", "iptables command"),
        (r"\biptables-legacy\b", "iptables-legacy command"),
        (r"\bnftables\b", "nftables command"),
        (r"\bsysctl\b", "sysctl command"),
    ]

    for pattern, description in forbidden_patterns:
        match = re.search(pattern, content)
        assert match is None, (
            f"Security policy violation: Found '{description}' in {VERIFY_SCRIPT}: "
            f"'{match.group(0)}' at character position {match.start()}."
        )


def test_compose_project_isolation_configured():
    """Verify that Compose commands utilize explicit project isolation."""
    content = VERIFY_SCRIPT.read_text(encoding="utf-8")
    assert 'COMPOSE_PROJECT = "megalith-verify"' in content
    assert '"-p", COMPOSE_PROJECT' in content
    assert 'COMPOSE_BASE + ["down", "-v"]' in content


def test_preflight_fails_when_docker_cli_missing(monkeypatch, capsys):
    """Verify preflight diagnostic terminates safely when docker CLI is not on PATH."""
    sys.path.insert(0, str(REPO_ROOT / "tooling"))
    try:
        import verify_containers

        monkeypatch.setattr(verify_containers.shutil, "which", lambda cmd: None)

        with pytest.raises(SystemExit) as exc_info:
            verify_containers.check_preflight_environment()

        assert exc_info.value.code == 1
        captured = capsys.readouterr()
        assert "ERROR: 'docker' CLI not found on PATH" in captured.out
    finally:
        sys.path.remove(str(REPO_ROOT / "tooling"))


def test_preflight_fails_when_docker_daemon_unreachable(monkeypatch, capsys):
    """Verify preflight diagnostic terminates safely when Docker daemon is not running."""
    sys.path.insert(0, str(REPO_ROOT / "tooling"))
    try:
        import verify_containers

        monkeypatch.setattr(verify_containers.shutil, "which", lambda cmd: "/usr/bin/docker")

        mock_daemon = MagicMock()
        mock_daemon.returncode = 1
        mock_daemon.stderr = "Cannot connect to the Docker daemon at unix:///var/run/docker.sock"
        monkeypatch.setattr(verify_containers.subprocess, "run", lambda *args, **kwargs: mock_daemon)

        with pytest.raises(SystemExit) as exc_info:
            verify_containers.check_preflight_environment()

        assert exc_info.value.code == 1
        captured = capsys.readouterr()
        assert "ERROR: Docker daemon is not running" in captured.out
    finally:
        sys.path.remove(str(REPO_ROOT / "tooling"))


def test_preflight_succeeds_when_docker_healthy(monkeypatch, capsys):
    """Verify preflight diagnostic succeeds without raising when Docker is available."""
    sys.path.insert(0, str(REPO_ROOT / "tooling"))
    try:
        import verify_containers

        monkeypatch.setattr(verify_containers.shutil, "which", lambda cmd: "/usr/bin/docker")

        mock_daemon = MagicMock()
        mock_daemon.returncode = 0
        mock_daemon.stderr = ""
        monkeypatch.setattr(verify_containers.subprocess, "run", lambda *args, **kwargs: mock_daemon)

        # Should not raise
        verify_containers.check_preflight_environment()

        captured = capsys.readouterr()
        assert "Docker daemon is reachable" in captured.out
        assert "privileged host changes disabled" in captured.out
    finally:
        sys.path.remove(str(REPO_ROOT / "tooling"))


def test_inter_container_forwarding_failure_diagnostic_text():
    """Verify that verify_containers.py contains clear guidance on bridge forwarding and operations doc."""
    content = VERIFY_SCRIPT.read_text(encoding="utf-8")
    assert "docs/operations/container-verification.md" in content
    assert "Inter-container communication failed with HTTP" in content
    assert "This environment cannot support container-to-container bridge forwarding." in content


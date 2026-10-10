"""
Automated regression tests verifying CI workflow structure, security rules, and action pinning.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
WORKFLOW_FILE = REPO_ROOT / ".github" / "workflows" / "ci.yaml"

SHA1_REGEX = re.compile(r"^[0-9a-f]{40}$")


@pytest.fixture
def workflow_data():
    assert WORKFLOW_FILE.is_file(), f"Workflow file not found: {WORKFLOW_FILE}"
    with open(WORKFLOW_FILE, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    assert isinstance(data, dict), "Workflow YAML must parse as a dictionary"
    return data


def test_workflow_triggers(workflow_data):
    # In PyYAML, 'on' key parses as boolean True
    triggers = workflow_data.get(True) or workflow_data.get("on")
    assert triggers is not None, "Workflow must declare 'on' trigger specification"

    assert "pull_request" in triggers, "Workflow must trigger on pull_request"
    assert triggers["pull_request"].get("branches") == ["main"]

    assert "push" in triggers, "Workflow must trigger on push"
    assert triggers["push"].get("branches") == ["main"]

    assert "workflow_dispatch" in triggers, "Workflow must trigger on workflow_dispatch"


def test_workflow_least_privilege_permissions(workflow_data):
    perms = workflow_data.get("permissions")
    assert perms == {"contents": "read"}, (
        f"Workflow must restrict permissions to contents: read. Found: {perms}"
    )


def test_no_pull_request_target_used():
    raw_text = WORKFLOW_FILE.read_text(encoding="utf-8")
    assert "pull_request_target" not in raw_text, (
        "Security policy violation: pull_request_target is forbidden."
    )


def test_all_actions_pinned_to_immutable_shas(workflow_data):
    jobs = workflow_data.get("jobs", {})
    action_uses: list[str] = []

    for job_id, job_spec in jobs.items():
        steps = job_spec.get("steps", [])
        for step in steps:
            uses = step.get("uses")
            if uses:
                action_uses.append(uses)

    assert len(action_uses) > 0, "Workflow must contain action step references"

    for uses in action_uses:
        # Expected format: action-owner/repo-name@40-char-sha
        assert "@" in uses, f"Action reference '{uses}' must include '@<sha>' pin"
        action_name, pin = uses.split("@", 1)
        # Strip any trailing comment or space
        pin_sha = pin.split()[0].strip()
        assert SHA1_REGEX.match(pin_sha), (
            f"Action '{uses}' is not pinned to a valid 40-character immutable SHA1 hash. Found: '{pin_sha}'"
        )


def test_required_gate_architecture(workflow_data):
    jobs = workflow_data.get("jobs", {})

    expected_jobs = {
        "changes",
        "platform",
        "demo-api",
        "demo-web",
        "container-build-api",
        "container-build-web",
        "container-smoke",
        "required",
    }
    assert expected_jobs.issubset(set(jobs.keys())), (
        f"Missing required jobs in workflow. Expected at least {expected_jobs}, found {set(jobs.keys())}"
    )

    required_job = jobs["required"]
    assert required_job.get("name") == "CI / required"
    assert required_job.get("if") == "always()"

    needs = set(required_job.get("needs", []))
    expected_dependencies = expected_jobs - {"required"}
    assert expected_dependencies == needs, (
        f"'required' gate must depend on all preceding jobs. Missing: {expected_dependencies - needs}"
    )


def test_concurrency_configuration(workflow_data):
    concurrency = workflow_data.get("concurrency")
    assert concurrency is not None, "Workflow must declare concurrency control"
    assert "group" in concurrency
    assert "cancel-in-progress" in concurrency

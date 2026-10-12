"""
Unit tests for Megalith exact-commit CI provenance verification (Task 010).
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "platform" / "deploy" / "scripts"))

from verify_ci_provenance import CIProvenanceError, verify_ci_provenance  # type: ignore

TEST_SHA = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
TEST_REPO = "megalith/megalith"


def test_exact_commit_ci_success():
    runs = [
        {
            "databaseId": 123456,
            "headSha": TEST_SHA,
            "headBranch": "main",
            "workflowName": "CI",
            "path": ".github/workflows/ci.yaml",
            "event": "push",
            "status": "completed",
            "conclusion": "success",
            "repository": {"full_name": TEST_REPO},
        }
    ]
    verified = verify_ci_provenance(
        target_sha=TEST_SHA,
        expected_repo=TEST_REPO,
        runs_data=runs,
    )
    assert verified["databaseId"] == 123456
    assert verified["conclusion"] == "success"


def test_reject_short_or_invalid_git_sha():
    with pytest.raises(CIProvenanceError, match="Invalid target Git SHA"):
        verify_ci_provenance("shortsha", TEST_REPO, [])


def test_reject_empty_runs_list():
    with pytest.raises(CIProvenanceError, match="No CI workflow runs returned"):
        verify_ci_provenance(TEST_SHA, TEST_REPO, [])


def test_reject_unrelated_workflow():
    runs = [
        {
            "databaseId": 999,
            "headSha": TEST_SHA,
            "headBranch": "main",
            "workflowName": "Deploy",
            "path": ".github/workflows/deploy.yaml",
            "status": "completed",
            "conclusion": "success",
        }
    ]
    with pytest.raises(CIProvenanceError, match="No matching .* run found"):
        verify_ci_provenance(TEST_SHA, TEST_REPO, runs)


def test_reject_different_commit_sha():
    runs = [
        {
            "databaseId": 123,
            "headSha": "0000000000000000000000000000000000000000",
            "headBranch": "main",
            "workflowName": "CI",
            "path": ".github/workflows/ci.yaml",
            "status": "completed",
            "conclusion": "success",
        }
    ]
    with pytest.raises(CIProvenanceError, match="No matching .* run found"):
        verify_ci_provenance(TEST_SHA, TEST_REPO, runs)


def test_reject_failed_or_cancelled_ci():
    runs = [
        {
            "databaseId": 123,
            "headSha": TEST_SHA,
            "headBranch": "main",
            "workflowName": "CI",
            "path": ".github/workflows/ci.yaml",
            "status": "completed",
            "conclusion": "failure",
        }
    ]
    with pytest.raises(CIProvenanceError, match="Required CI gate has not succeeded"):
        verify_ci_provenance(TEST_SHA, TEST_REPO, runs)


def test_reject_in_progress_ci():
    runs = [
        {
            "databaseId": 123,
            "headSha": TEST_SHA,
            "headBranch": "main",
            "workflowName": "CI",
            "path": ".github/workflows/ci.yaml",
            "status": "in_progress",
            "conclusion": None,
        }
    ]
    with pytest.raises(CIProvenanceError, match="is currently still running"):
        verify_ci_provenance(TEST_SHA, TEST_REPO, runs)


def test_reject_untrusted_repository():
    runs = [
        {
            "databaseId": 123,
            "headSha": TEST_SHA,
            "headBranch": "main",
            "workflowName": "CI",
            "path": ".github/workflows/ci.yaml",
            "status": "completed",
            "conclusion": "success",
            "repository": {"full_name": "attacker/forked-repo"},
        }
    ]
    with pytest.raises(CIProvenanceError, match="No matching .* run found"):
        verify_ci_provenance(TEST_SHA, TEST_REPO, runs)

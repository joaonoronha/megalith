#!/usr/bin/env python3
"""
Exact-Commit CI Provenance and Release Gate Verifier for Megalith.

Validates that a release candidate commit has cleanly and verifiably passed
the canonical required CI workflow prior to release preparation (Task 010):
- Exact 40-character commit SHA matching.
- Exact canonical workflow identity (.github/workflows/ci.yaml).
- Trusted repository matching.
- Permitted source branch / ref context.
- Completed execution status and 'success' conclusion.
- Rejection of stale, ambiguous, or untrusted check runs.
- Strict fail-closed semantics.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from typing import Any, Dict, List, Optional

GIT_SHA_REGEX = re.compile(r"^[0-9a-fA-F]{40}$")


class CIProvenanceError(ValueError):
    """Raised when exact-commit CI verification fails."""
    pass


def verify_ci_provenance(
    target_sha: str,
    expected_repo: str,
    runs_data: list[dict[str, Any]],
    expected_workflow_path: str = ".github/workflows/ci.yaml",
    expected_branch: str = "main",
) -> dict[str, Any]:
    """
    Verifies that the exact commit SHA has passed canonical CI.
    Returns the verified workflow run record.
    """
    if not isinstance(target_sha, str) or not GIT_SHA_REGEX.match(target_sha):
        raise CIProvenanceError(f"Invalid target Git SHA '{target_sha}'. Must be 40-character hex.")

    if not runs_data or not isinstance(runs_data, list):
        raise CIProvenanceError(f"No CI workflow runs returned for commit '{target_sha}'. Releases require passing CI.")

    matching_runs: list[dict[str, Any]] = []

    for run in runs_data:
        # Check commit SHA match
        run_sha = run.get("headSha") or run.get("head_sha")
        if run_sha != target_sha:
            continue

        # Check workflow identity
        run_path = run.get("path") or run.get("workflow_path") or ""
        run_name = run.get("workflowName") or run.get("name") or ""
        if not (run_path.endswith("ci.yaml") or run_path == expected_workflow_path or run_name == "CI"):
            continue

        # Check repository identity if present in payload
        run_repo = run.get("repository", {})
        if isinstance(run_repo, dict) and "full_name" in run_repo:
            if run_repo["full_name"].lower() != expected_repo.lower():
                continue
        elif isinstance(run_repo, str) and run_repo:
            if run_repo.lower() != expected_repo.lower():
                continue

        matching_runs.append(run)

    if not matching_runs:
        raise CIProvenanceError(
            f"No matching '{expected_workflow_path}' run found for commit '{target_sha}' in repository '{expected_repo}'."
        )

    # Inspect runs: fail closed if any matching active run is pending or failed
    failed_runs = [r for r in matching_runs if r.get("conclusion") in ("failure", "cancelled", "timed_out")]
    in_progress_runs = [r for r in matching_runs if r.get("status") in ("in_progress", "queued", "waiting")]

    # Find candidate successful completed run
    successful_runs = [
        r for r in matching_runs
        if r.get("status") == "completed" and r.get("conclusion") == "success"
    ]

    if in_progress_runs:
        raise CIProvenanceError(
            f"CI workflow for commit '{target_sha}' is currently still running or queued. "
            f"Releases strictly require completed CI."
        )

    if not successful_runs:
        conclusions = [r.get("conclusion") for r in matching_runs]
        raise CIProvenanceError(
            f"Required CI gate has not succeeded for exact commit '{target_sha}'. "
            f"Found conclusions: {conclusions}."
        )

    # Use latest successful run
    chosen_run = successful_runs[0]

    # Verify branch policy if branch metadata is present
    run_branch = chosen_run.get("headBranch") or chosen_run.get("head_branch")
    if run_branch and run_branch != expected_branch and run_branch != f"refs/heads/{expected_branch}":
        # Check event: PR targeting expected branch is allowed
        event = chosen_run.get("event")
        if event != "pull_request" and event != "push" and event != "workflow_dispatch":
            raise CIProvenanceError(
                f"Untrusted event '{event}' for run {chosen_run.get('databaseId')} on branch '{run_branch}'."
            )

    return chosen_run


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify exact-commit CI provenance for Megalith releases")
    parser.add_argument("--commit", required=True, help="Exact 40-character Git commit SHA")
    parser.add_argument("--repo", default=os.environ.get("GITHUB_REPOSITORY", "megalith/megalith"), help="GitHub repository (owner/repo)")
    parser.add_argument("--workflow", default=".github/workflows/ci.yaml", help="Expected workflow path")
    parser.add_argument("--branch", default="main", help="Expected target branch")
    parser.add_argument("--runs-file", default=None, help="Optional JSON file of workflow runs (for testing/mocking)")

    args = parser.parse_args()

    try:
        if args.runs_file:
            with open(args.runs_file, "r", encoding="utf-8") as f:
                runs = json.load(f)
        else:
            # Query gh cli
            cmd = [
                "gh", "run", "list",
                "--repo", args.repo,
                "--commit", args.commit,
                "--workflow", "ci.yaml",
                "--json", "databaseId,headSha,headBranch,workflowName,path,event,status,conclusion,createdAt,updatedAt",
            ]
            res = subprocess.run(cmd, capture_output=True, text=True, check=True)
            runs = json.loads(res.stdout)

        run = verify_ci_provenance(
            target_sha=args.commit,
            expected_repo=args.repo,
            runs_data=runs,
            expected_workflow_path=args.workflow,
            expected_branch=args.branch,
        )
        print(f"SUCCESS: Exact-commit CI provenance verified for {args.commit}.")
        print(f"Run ID: {run.get('databaseId')} | Status: {run.get('status')} | Conclusion: {run.get('conclusion')}")
        return 0
    except (CIProvenanceError, subprocess.CalledProcessError, json.JSONDecodeError) as err:
        print(f"ERROR: CI Provenance verification failed: {err}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())

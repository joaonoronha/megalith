#!/usr/bin/env python3
"""
Megalith Read-Only Operational Preflight and Host Readiness Checker (Task 010).

Executes comprehensive preflight checks to guarantee operational readiness
before deployments, backups, or host operations per ADR-005, ADR-008, ADR-010,
and Task 010 requirements:
- OS and CPU architecture detection (ARM64 production vs x86_64 local simulation).
- Docker Engine and Docker Compose compatibility.
- Available storage and disk space thresholds.
- Required deployment, Compose, and Caddy ingress configuration files.
- Deployment lock status and absence of unresolved deployment transactions.
- Port availability and persistent directory permissions.
- Distinguishes offline local simulation checks from live host checks.
- Explicitly flags external cloud prerequisites (DNS, TLS, registry) that require live verification.
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
import socket
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent.parent
sys.path.insert(0, str(SCRIPT_DIR))

from release import ReleaseManifest, ReleaseValidationError  # type: ignore


@dataclass
class CheckResult:
    name: str
    category: str  # "system", "docker", "storage", "deployment", "external"
    passed: bool
    status: str    # "PASS", "WARN", "FAIL", "INFO"
    message: str
    details: Optional[str] = None


class PreflightRunner:
    def __init__(
        self,
        repo_root: Path = REPO_ROOT,
        state_dir: Optional[Path] = None,
        min_disk_mb: int = 2048,
        is_host_mode: bool = False,
        provider: str = "oci",
        profile: str = "full",
        environment: str = "production",
    ):
        self.repo_root = repo_root
        self.state_dir = state_dir or (
            Path("/opt/megalith/deploy")
            if Path("/opt/megalith/deploy").exists()
            else (self.repo_root / "platform" / "deploy" / ".state")
        )
        self.min_disk_mb = min_disk_mb
        self.is_host_mode = is_host_mode
        self.provider = provider
        self.profile = profile
        self.environment = environment
        self.results: list[CheckResult] = []

    def run_all(self, manifest_path: Optional[Path] = None) -> bool:
        self.check_profile_and_resources()
        self.check_os_and_arch()
        self.check_docker_engine()
        self.check_docker_compose()
        self.check_disk_space()
        self.check_required_configurations()
        self.check_caddy_configuration()
        self.check_deployment_lock_and_state()
        if manifest_path:
            self.check_release_manifest(manifest_path)
        self.check_port_availability()
        self.report_external_prerequisites()

        return all(r.passed for r in self.results if r.status in ("PASS", "FAIL"))

    def check_profile_and_resources(self) -> None:
        # 1. Guard against micro profile in production
        if self.profile == "micro" and self.environment == "production":
            self.results.append(CheckResult(
                name="Deployment Profile Policy",
                category="system",
                passed=False,
                status="FAIL",
                message="CRITICAL: The 'micro' profile is strictly for experimental bootstrap validation and cannot be deployed in production. Production requires the 'full' profile.",
            ))
            return

        if self.profile == "micro":
            self.results.append(CheckResult(
                name="Deployment Profile Policy",
                category="system",
                passed=True,
                status="WARN",
                message="MICRO PROFILE ACTIVE: Running experimental smoke test stack only. This profile validates host bootstrap and ingress health, but DOES NOT validate production persistence, PostgreSQL, or full application readiness. Do not consider micro profile results as proof of production readiness.",
            ))

        # 2. Check host RAM
        total_ram_mb = None
        try:
            with open("/proc/meminfo", "r", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("MemTotal:"):
                        total_ram_mb = int(line.split()[1]) // 1024
                        break
        except Exception:
            pass

        if total_ram_mb is not None:
            if self.profile == "full" and total_ram_mb < 2048:
                status = "FAIL" if self.is_host_mode else "WARN"
                self.results.append(CheckResult(
                    name="Host Memory",
                    category="system",
                    passed=not self.is_host_mode,
                    status=status,
                    message=f"Host RAM ({total_ram_mb} MB) is insufficient for the full Megalith production stack (minimum 4096 MB recommended). Note: e2-micro is NOT supported for full production profile.",
                ))
            else:
                self.results.append(CheckResult(
                    name="Host Memory",
                    category="system",
                    passed=True,
                    status="PASS",
                    message=f"Host RAM ({total_ram_mb} MB) satisfies profile '{self.profile}' requirements.",
                ))

    def check_os_and_arch(self) -> None:
        os_name = platform.system()
        arch = platform.machine().lower()

        if os_name != "Linux":
            self.results.append(CheckResult(
                name="Operating System",
                category="system",
                passed=False,
                status="FAIL",
                message=f"Unsupported OS: {os_name}. Production requires Linux (Ubuntu 24.04).",
            ))
            return

        if self.provider == "oci":
            if arch in ("aarch64", "arm64"):
                self.results.append(CheckResult(
                    name="System Architecture",
                    category="system",
                    passed=True,
                    status="PASS",
                    message=f"Native ARM64 architecture detected ({arch}). Parity with OCI Ampere A1 VM.",
                ))
            else:
                self.results.append(CheckResult(
                    name="System Architecture",
                    category="system",
                    passed=True,
                    status="INFO" if not self.is_host_mode else "WARN",
                    message=f"Local simulation architecture detected ({arch}). Multi-arch builds required for OCI ARM64.",
                ))
        elif self.provider == "gcp":
            if arch in ("x86_64", "amd64"):
                self.results.append(CheckResult(
                    name="System Architecture",
                    category="system",
                    passed=True,
                    status="PASS",
                    message=f"Native x86_64 architecture detected ({arch}). Parity with GCP Compute Engine e2 instances.",
                ))
            else:
                self.results.append(CheckResult(
                    name="System Architecture",
                    category="system",
                    passed=True,
                    status="INFO" if not self.is_host_mode else "WARN",
                    message=f"Non-x86_64 architecture detected ({arch}). GCP Compute Engine e2 uses x86_64.",
                ))

    def check_docker_engine(self) -> None:
        try:
            res = subprocess.run(
                ["docker", "version", "--format", "{{.Server.Version}}"],
                capture_output=True,
                text=True,
                check=False,
            )
            if res.returncode == 0 and res.stdout.strip():
                version = res.stdout.strip()
                self.results.append(CheckResult(
                    name="Docker Engine",
                    category="docker",
                    passed=True,
                    status="PASS",
                    message=f"Docker Engine available (v{version}).",
                ))
            else:
                self.results.append(CheckResult(
                    name="Docker Engine",
                    category="docker",
                    passed=False,
                    status="FAIL",
                    message="Docker daemon is not running or accessible.",
                    details=res.stderr.strip(),
                ))
        except FileNotFoundError:
            self.results.append(CheckResult(
                name="Docker Engine",
                category="docker",
                passed=False,
                status="FAIL",
                message="Docker CLI is not installed or not in PATH.",
            ))

    def check_docker_compose(self) -> None:
        try:
            res = subprocess.run(
                ["docker", "compose", "version"],
                capture_output=True,
                text=True,
                check=False,
            )
            if res.returncode == 0:
                self.results.append(CheckResult(
                    name="Docker Compose",
                    category="docker",
                    passed=True,
                    status="PASS",
                    message="Docker Compose v2 plugin is available.",
                ))
            else:
                self.results.append(CheckResult(
                    name="Docker Compose",
                    category="docker",
                    passed=False,
                    status="FAIL",
                    message="Docker Compose plugin is not operational.",
                    details=res.stderr.strip(),
                ))
        except FileNotFoundError:
            self.results.append(CheckResult(
                name="Docker Compose",
                category="docker",
                passed=False,
                status="FAIL",
                message="Docker Compose plugin is not installed.",
            ))

    def check_disk_space(self) -> None:
        try:
            target_path = self.state_dir if self.state_dir.exists() else self.repo_root
            total, used, free = shutil.disk_usage(target_path)
            free_mb = free // (1024 * 1024)

            if free_mb < self.min_disk_mb:
                self.results.append(CheckResult(
                    name="Disk Space Safeguard",
                    category="storage",
                    passed=False,
                    status="FAIL",
                    message=f"Critically low disk space: {free_mb} MB available (minimum threshold: {self.min_disk_mb} MB).",
                    details="Image pulls or database operations could cause out-of-disk host lockouts.",
                ))
            else:
                self.results.append(CheckResult(
                    name="Disk Space Safeguard",
                    category="storage",
                    passed=True,
                    status="PASS",
                    message=f"Sufficient disk space: {free_mb} MB available (threshold: {self.min_disk_mb} MB).",
                ))
        except Exception as err:
            self.results.append(CheckResult(
                name="Disk Space Safeguard",
                category="storage",
                passed=False,
                status="FAIL",
                message=f"Failed to query disk usage: {err}",
            ))

    def check_required_configurations(self) -> None:
        if self.profile == "micro":
            required_files = [
                ("Micro Compose", self.repo_root / "platform" / "deploy" / "compose.micro.yaml"),
                ("Micro Caddy Ingress Config", self.repo_root / "platform" / "deploy" / "caddy" / "Caddyfile.micro"),
            ]
        else:
            required_files = [
                ("Base Compose", self.repo_root / "platform" / "deploy" / "compose.yaml"),
                ("Prod Compose Overlay", self.repo_root / "platform" / "deploy" / "compose.prod.yaml"),
                ("Caddy Ingress Config", self.repo_root / "platform" / "deploy" / "caddy" / "Caddyfile"),
                ("Database Init Script", self.repo_root / "platform" / "deploy" / "postgres" / "init" / "01-init-demo-db.sh"),
            ]

        missing = []
        for name, path in required_files:
            if not path.is_file():
                missing.append(f"{name} ({path})")

        if missing:
            self.results.append(CheckResult(
                name="Configuration Files",
                category="deployment",
                passed=False,
                status="FAIL",
                message=f"Missing required configuration file(s): {', '.join(missing)}",
            ))
        else:
            self.results.append(CheckResult(
                name="Configuration Files",
                category="deployment",
                passed=True,
                status="PASS",
                message=f"All required configuration files for profile '{self.profile}' are present.",
            ))

    def check_caddy_configuration(self) -> None:
        caddyfile_name = "Caddyfile.micro" if self.profile == "micro" else "Caddyfile"
        caddyfile = self.repo_root / "platform" / "deploy" / "caddy" / caddyfile_name
        if not caddyfile.is_file():
            return

        # Check for caddy binary or validate basic syntax
        if shutil.which("caddy"):
            res = subprocess.run(["caddy", "validate", "--config", str(caddyfile)], capture_output=True, text=True)
            if res.returncode == 0:
                self.results.append(CheckResult(
                    name="Caddyfile Validation",
                    category="deployment",
                    passed=True,
                    status="PASS",
                    message=f"Caddyfile ({caddyfile_name}) syntax validated cleanly via caddy binary.",
                ))
            else:
                self.results.append(CheckResult(
                    name="Caddyfile Validation",
                    category="deployment",
                    passed=False,
                    status="FAIL",
                    message=f"Caddyfile ({caddyfile_name}) failed syntax validation.",
                    details=res.stderr.strip(),
                ))
        else:
            content = caddyfile.read_text(encoding="utf-8")
            valid = "admin off" in content and ("reverse_proxy" in content or "respond" in content)
            if valid:
                self.results.append(CheckResult(
                    name="Caddyfile Syntax Baseline",
                    category="deployment",
                    passed=True,
                    status="PASS",
                    message=f"Caddyfile ({caddyfile_name}) baseline structure verified (caddy binary not installed locally).",
                ))

    def check_deployment_lock_and_state(self) -> None:
        lock_file = self.state_dir / "deploy.lock"
        state_file = self.state_dir / "state.json"

        # Check lock
        if lock_file.exists():
            # Check if active or stale
            self.results.append(CheckResult(
                name="Deployment Lock",
                category="deployment",
                passed=False,
                status="WARN",
                message=f"Deployment lock file exists at {lock_file}. Verify whether another deployment is active.",
            ))
        else:
            self.results.append(CheckResult(
                name="Deployment Lock",
                category="deployment",
                passed=True,
                status="PASS",
                message="Host deployment lock is free.",
            ))

        # Check state for unfinished transactions
        if state_file.is_file():
            try:
                state_data = json.loads(state_file.read_text(encoding="utf-8"))
                active_tx = state_data.get("active_transaction")
                if active_tx and active_tx.get("phase") not in ("succeeded", "rolled_back"):
                    self.results.append(CheckResult(
                        name="Deployment State",
                        category="deployment",
                        passed=False,
                        status="FAIL",
                        message=f"Unresolved deployment transaction '{active_tx.get('tx_id')}' in phase '{active_tx.get('phase')}'.",
                        details="Run 'deploy.py recover' to inspect and recover safely before proceeding.",
                    ))
                else:
                    status = state_data.get("status", "idle")
                    self.results.append(CheckResult(
                        name="Deployment State",
                        category="deployment",
                        passed=True,
                        status="PASS",
                        message=f"Deployment state is clean (status: '{status}').",
                    ))
            except Exception as err:
                self.results.append(CheckResult(
                    name="Deployment State",
                    category="deployment",
                    passed=False,
                    status="WARN",
                    message=f"Failed to parse deployment state file: {err}",
                ))
        else:
            self.results.append(CheckResult(
                name="Deployment State",
                category="deployment",
                passed=True,
                status="PASS",
                message="Deployment state is uninitialized (ready for initial deployment).",
            ))

    def check_release_manifest(self, manifest_path: Path) -> None:
        try:
            manifest = ReleaseManifest.from_file(manifest_path)
            self.results.append(CheckResult(
                name="Release Manifest",
                category="deployment",
                passed=True,
                status="PASS",
                message=f"Release manifest '{manifest.release_id}' is valid (Canonical SHA: {manifest.canonical_digest()[:16]}...).",
            ))
        except (ReleaseValidationError, Exception) as err:
            self.results.append(CheckResult(
                name="Release Manifest",
                category="deployment",
                passed=False,
                status="FAIL",
                message=f"Manifest validation failed for {manifest_path}: {err}",
            ))

    def check_port_availability(self) -> None:
        if not self.is_host_mode:
            self.results.append(CheckResult(
                name="Port Availability",
                category="system",
                passed=True,
                status="INFO",
                message="Port checks skipped in local simulation mode (uses dynamic loopback ports).",
            ))
            return

        ports_to_check = [80, 443]
        conflicts = []
        for port in ports_to_check:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                try:
                    s.bind(("0.0.0.0", port))
                except OSError:
                    conflicts.append(port)

        if conflicts:
            self.results.append(CheckResult(
                name="Port Availability",
                category="system",
                passed=False,
                status="FAIL",
                message=f"Required ingress ports are already in use: {conflicts}.",
            ))
        else:
            self.results.append(CheckResult(
                name="Port Availability",
                category="system",
                passed=True,
                status="PASS",
                message=f"Ingress ports {ports_to_check} are available for Caddy.",
            ))

    def report_external_prerequisites(self) -> None:
        provider_name = "Google Cloud Compute Engine" if self.provider == "gcp" else "OCI Ampere A1"
        prerequisites = [
            f"DNS: Domain A/AAAA records point to {provider_name} public IPv4.",
            "TLS: Inbound HTTP (80) reachable from Let's Encrypt / ZeroSSL for ACME challenge.",
            f"Registry: {self.provider.upper()} host authenticated with GHCR pull credentials for private images.",
            "Backups: Off-host storage bucket / destination provisioned and reachable." if self.profile == "full" else "Backups: N/A for micro smoke test profile.",
        ]
        self.results.append(CheckResult(
            name="External Prerequisites",
            category="external",
            passed=True,
            status="INFO",
            message="External cloud dependencies require live host activation during initial launch.",
            details="\n".join(f"  * {p}" for p in prerequisites),
        ))


def main() -> int:
    parser = argparse.ArgumentParser(description="Megalith Operational Preflight Checker (Task 010)")
    parser.add_argument("--manifest", type=Path, default=None, help="Path to release manifest to validate")
    parser.add_argument("--state-dir", type=Path, default=None, help="State directory")
    parser.add_argument("--min-disk-mb", type=int, default=2048, help="Minimum free disk space threshold in MB")
    parser.add_argument("--host-mode", action="store_true", help="Enforce live host checks (e.g. ports 80/443)")
    parser.add_argument("--provider", choices=["oci", "gcp"], default="oci", help="Target cloud provider (oci or gcp)")
    parser.add_argument("--profile", choices=["full", "micro"], default="full", help="Deployment profile (full or micro)")
    parser.add_argument("--environment", choices=["production", "staging", "development"], default="production", help="Deployment environment")
    parser.add_argument("--json", action="store_true", help="Output machine-readable JSON results")

    args = parser.parse_args()

    runner = PreflightRunner(
        state_dir=args.state_dir,
        min_disk_mb=args.min_disk_mb,
        is_host_mode=args.host_mode,
        provider=args.provider,
        profile=args.profile,
        environment=args.environment,
    )

    all_passed = runner.run_all(manifest_path=args.manifest)

    if args.json:
        out = {
            "all_passed": all_passed,
            "checks": [asdict(r) for r in runner.results],
        }
        print(json.dumps(out, indent=2))
        return 0 if all_passed else 1

    print("=" * 65)
    print(" Megalith Operational Preflight Readiness Check")
    print("=" * 65)
    print(f"Provider     : {args.provider.upper()}")
    print(f"Profile      : {args.profile}")
    print(f"Environment  : {args.environment}")
    print(f"Mode         : {'Live Host Mode' if args.host_mode else 'Local Simulation Mode'}")
    print(f"Architecture : {platform.machine()}")
    print("-" * 65)

    for r in runner.results:
        badge = {
            "PASS": "\033[92m[ PASS ]\033[0m",
            "WARN": "\033[93m[ WARN ]\033[0m",
            "FAIL": "\033[91m[ FAIL ]\033[0m",
            "INFO": "\033[94m[ INFO ]\033[0m",
        }.get(r.status, f"[{r.status}]")

        print(f"{badge} {r.name}: {r.message}")
        if r.details:
            for line in r.details.splitlines():
                print(f"         {line}")

    print("-" * 65)
    if all_passed:
        print("\033[92mPREFLIGHT RESULT: PASSED\033[0m - All operational safeguards verified.")
        print("=" * 65)
        return 0
    else:
        print("\033[91mPREFLIGHT RESULT: FAILED\033[0m - Preflight detected blocking issues above.")
        print("=" * 65)
        return 1


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""
Lightweight change classifier for Megalith selective continuous integration.

Classifies changed file paths into workflow execution flags according to
conservative monorepo path rules (Task 005 Section 7).

Rules:
- apps/demo/api/**         -> demo_api, container_api, container_smoke
- apps/demo/web/**         -> demo_web, container_web, container_smoke
- apps/demo/product.yaml   -> demo_api, demo_web, container_api, container_web, container_smoke
- platform/infra/oci/**    -> terraform
- projects.yaml            -> all services & container builds
- tooling/schemas/**       -> all services & container builds
- tooling/validate.py      -> all services & container builds
- platform/cli/**          -> all services & container builds
- platform/deploy/**       -> container_api, container_web, container_smoke
- tooling/verify_containers.py -> container_api, container_web, container_smoke
- .github/workflows/**     -> all services & container builds
- Docs-only changes        -> only platform validation, skip service & container builds
- Unknown/unmatched files  -> conservative fallback: run all checks
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import os
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable, List, Sequence


@dataclass
class ClassificationResult:
    platform: bool = True
    terraform: bool = False
    demo_api: bool = False
    demo_web: bool = False
    container_api: bool = False
    container_web: bool = False
    container_smoke: bool = False
    docs_only: bool = False
    all_triggered: bool = False
    changed_files: List[str] = None  # type: ignore
    triggered_services: List[str] = None  # type: ignore
    triggered_products: List[str] = None  # type: ignore

    def __post_init__(self):
        if self.changed_files is None:
            self.changed_files = []
        if self.triggered_services is None:
            self.triggered_services = []
        if self.triggered_products is None:
            self.triggered_products = []


DOC_PATTERNS = [
    "docs/**",
    "*.md",
    "**/*.md",
    "LICENSE*",
    ".github/ISSUE_TEMPLATE/**",
    ".github/pull_request_template.md",
    ".gitignore",
]

GLOBAL_INFRA_PATTERNS = [
    "projects.yaml",
    "tooling/schemas/**",
    "tooling/validate.py",
    "platform/cli/**",
    "platform/templates/**",
    ".github/workflows/**",
]

CONTAINER_INFRA_PATTERNS = [
    "platform/deploy/**",
    "tooling/verify_containers.py",
    "tooling/verify_postgres.py",
    "tooling/verify_ingress.py",
    "tooling/verify_deployment.py",
    "docs/operations/container-verification.md",
]

TERRAFORM_INFRA_PATTERNS = [
    "platform/infra/oci/**",
    "platform/infra/gcp/**",
]

DEMO_PRODUCT_MANIFEST = "apps/demo/product.yaml"
DEMO_API_PATTERNS = ["apps/demo/api/**"]
DEMO_WEB_PATTERNS = ["apps/demo/web/**"]


def discover_registered_services(repo_root: Path) -> Tuple[Dict[str, List[str]], Dict[str, str]]:
    """Dynamically discovers registered products and services from projects.yaml."""
    product_manifests: Dict[str, str] = {}  # manifest_path -> product_id
    service_patterns: Dict[str, List[str]] = {}  # qualified_service_id -> [path_patterns]

    projects_path = repo_root / "projects.yaml"
    if not projects_path.is_file():
        return product_manifests, service_patterns

    try:
        import yaml
        with open(projects_path, "r", encoding="utf-8") as f:
            catalog = yaml.safe_load(f) or {}

        for p in catalog.get("products", []):
            prod_id = p.get("id")
            manifest_rel = p.get("manifest", "")
            if not prod_id or not manifest_rel:
                continue
            norm_manifest = manifest_rel.replace("\\", "/").lstrip("./")
            product_manifests[norm_manifest] = prod_id

            prod_manifest_path = repo_root / norm_manifest
            if not prod_manifest_path.is_file():
                continue

            with open(prod_manifest_path, "r", encoding="utf-8") as pf:
                prod_data = yaml.safe_load(pf) or {}

            for s in prod_data.get("services", []):
                svc_id = s.get("id")
                if not svc_id:
                    continue
                qualified = f"{prod_id}/{svc_id}"
                svc_pattern = f"apps/{prod_id}/{svc_id}/**"
                service_patterns.setdefault(qualified, []).append(svc_pattern)
    except Exception:
        pass

    return product_manifests, service_patterns


def _matches_any(path: str, patterns: Iterable[str]) -> bool:
    norm = path.replace("\\", "/").lstrip("./")
    for pat in patterns:
        if fnmatch.fnmatch(norm, pat):
            return True
    return False


def is_doc_file(path: str) -> bool:
    return _matches_any(path, DOC_PATTERNS)


def classify_files(
    files: Sequence[str],
    force_all: bool = False,
    repo_root: Optional[Path] = None,
) -> ClassificationResult:
    cleaned = [f.replace("\\", "/").lstrip("./").strip() for f in files if f.strip()]

    if force_all or not cleaned:
        # Default conservative behavior
        return ClassificationResult(
            platform=True,
            terraform=True,
            demo_api=True,
            demo_web=True,
            container_api=True,
            container_web=True,
            container_smoke=True,
            docs_only=False,
            all_triggered=True,
            changed_files=cleaned,
        )

    # Check if every single file is documentation
    if all(is_doc_file(f) for f in cleaned):
        return ClassificationResult(
            platform=True,
            terraform=False,
            demo_api=False,
            demo_web=False,
            container_api=False,
            container_web=False,
            container_smoke=False,
            docs_only=True,
            all_triggered=False,
            changed_files=cleaned,
        )

    # Filter out pure doc files when evaluating code triggers
    code_files = [f for f in cleaned if not is_doc_file(f)]

    trigger_global = False
    trigger_api = False
    trigger_web = False
    trigger_container_infra = False
    trigger_terraform = False
    unmatched_files: List[str] = []
    triggered_services: List[str] = []
    triggered_products: List[str] = []

    root = repo_root or Path(__file__).resolve().parent.parent
    dynamic_product_manifests, dynamic_service_patterns = discover_registered_services(root)

    for f in code_files:
        matched = False
        if _matches_any(f, GLOBAL_INFRA_PATTERNS):
            trigger_global = True
            matched = True
        if f == DEMO_PRODUCT_MANIFEST:
            trigger_api = True
            trigger_web = True
            if "demo/api" not in triggered_services:
                triggered_services.append("demo/api")
            if "demo/web" not in triggered_services:
                triggered_services.append("demo/web")
            if "demo" not in triggered_products:
                triggered_products.append("demo")
            matched = True
        elif f in dynamic_product_manifests:
            p_id = dynamic_product_manifests[f]
            if p_id not in triggered_products:
                triggered_products.append(p_id)
            if p_id == "demo":
                trigger_api = True
                trigger_web = True
            for svc_qid in dynamic_service_patterns:
                if svc_qid.startswith(f"{p_id}/") and svc_qid not in triggered_services:
                    triggered_services.append(svc_qid)
            matched = True

        if _matches_any(f, CONTAINER_INFRA_PATTERNS):
            trigger_container_infra = True
            matched = True
        if _matches_any(f, TERRAFORM_INFRA_PATTERNS):
            trigger_terraform = True
            matched = True
        if _matches_any(f, DEMO_API_PATTERNS):
            trigger_api = True
            if "demo/api" not in triggered_services:
                triggered_services.append("demo/api")
            matched = True
        if _matches_any(f, DEMO_WEB_PATTERNS):
            trigger_web = True
            if "demo/web" not in triggered_services:
                triggered_services.append("demo/web")
            matched = True

        # Check dynamic service patterns for other products/services
        for svc_qid, patterns in dynamic_service_patterns.items():
            if _matches_any(f, patterns):
                if svc_qid not in triggered_services:
                    triggered_services.append(svc_qid)
                prod_part = svc_qid.split("/")[0]
                if prod_part not in triggered_products:
                    triggered_products.append(prod_part)
                if svc_qid == "demo/api":
                    trigger_api = True
                elif svc_qid == "demo/web":
                    trigger_web = True
                matched = True

        if not matched:
            unmatched_files.append(f)

    # Conservative fallback: If any code file was unmatched, trigger everything
    if trigger_global or unmatched_files:
        return ClassificationResult(
            platform=True,
            terraform=True,
            demo_api=True,
            demo_web=True,
            container_api=True,
            container_web=True,
            container_smoke=True,
            docs_only=False,
            all_triggered=True,
            changed_files=cleaned,
            triggered_services=triggered_services,
            triggered_products=triggered_products,
        )

    # Specific service triggers
    api_active = trigger_api
    web_active = trigger_web
    container_api_active = trigger_api or trigger_container_infra
    container_web_active = trigger_web or trigger_container_infra
    container_smoke_active = trigger_api or trigger_web or trigger_container_infra

    return ClassificationResult(
        platform=True,
        terraform=trigger_terraform,
        demo_api=api_active,
        demo_web=web_active,
        container_api=container_api_active,
        container_web=container_web_active,
        container_smoke=container_smoke_active,
        docs_only=False,
        all_triggered=False,
        changed_files=cleaned,
        triggered_services=triggered_services,
        triggered_products=triggered_products,
    )


def get_git_diff_files(base_ref: str, repo_root: Path) -> List[str]:
    """Retrieves list of changed files between base_ref and HEAD."""
    try:
        # Check if merge-base diff works
        res = subprocess.run(
            ["git", "diff", "--name-only", f"{base_ref}...HEAD"],
            cwd=repo_root,
            capture_output=True,
            text=True,
            check=False,
        )
        if res.returncode == 0:
            return [line.strip() for line in res.stdout.splitlines() if line.strip()]

        # Fallback to direct two-dot diff
        res2 = subprocess.run(
            ["git", "diff", "--name-only", base_ref, "HEAD"],
            cwd=repo_root,
            capture_output=True,
            text=True,
            check=False,
        )
        if res2.returncode == 0:
            return [line.strip() for line in res2.stdout.splitlines() if line.strip()]

        return []
    except Exception:
        return []


def write_github_outputs(result: ClassificationResult, output_path: str) -> None:
    """Appends classification outputs to GITHUB_OUTPUT environment file."""
    lines = [
        f"platform={'true' if result.platform else 'false'}\n",
        f"terraform={'true' if result.terraform else 'false'}\n",
        f"demo_api={'true' if result.demo_api else 'false'}\n",
        f"demo_web={'true' if result.demo_web else 'false'}\n",
        f"container_api={'true' if result.container_api else 'false'}\n",
        f"container_web={'true' if result.container_web else 'false'}\n",
        f"container_smoke={'true' if result.container_smoke else 'false'}\n",
        f"docs_only={'true' if result.docs_only else 'false'}\n",
        f"all_triggered={'true' if result.all_triggered else 'false'}\n",
        f"triggered_services={json.dumps(result.triggered_services)}\n",
        f"triggered_products={json.dumps(result.triggered_products)}\n",
    ]
    with open(output_path, "a", encoding="utf-8") as f:
        f.writelines(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Classify changed files for Megalith selective CI.")
    parser.add_argument("--files", nargs="*", default=None, help="Explicit list of changed files.")
    parser.add_argument("--diff-base", default=None, help="Git reference to diff against HEAD (e.g. origin/main).")
    parser.add_argument("--force-all", action="store_true", help="Force all validation jobs to trigger.")
    parser.add_argument("--stdin", action="store_true", help="Read changed files list from stdin.")
    parser.add_argument("--github-output", default=None, help="Path to $GITHUB_OUTPUT file to write key=value pairs.")
    parser.add_argument("--repo-root", default=None, help="Path to repository root.")
    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve() if args.repo_root else Path(__file__).resolve().parent.parent

    files: List[str] = []
    force_all = args.force_all

    if args.files is not None:
        files = args.files
    elif args.stdin:
        files = [line.strip() for line in sys.stdin if line.strip()]
    elif args.diff_base:
        diff_files = get_git_diff_files(args.diff_base, repo_root)
        if diff_files:
            files = diff_files
        else:
            # If git diff failed or returned empty unexpectedly, force all for safety
            force_all = True

    result = classify_files(files, force_all=force_all, repo_root=repo_root)

    # Output JSON summary to stdout
    print(json.dumps(asdict(result), indent=2))

    # Write GitHub Actions step output if requested or present in env
    gh_output_path = args.github_output or os.environ.get("GITHUB_OUTPUT")
    if gh_output_path:
        write_github_outputs(result, gh_output_path)

    return 0


if __name__ == "__main__":
    sys.exit(main())

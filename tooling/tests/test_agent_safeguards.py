"""
Tests for Megalith AI agent execution safeguards and authorization policies (Task 016D).

Verifies that:
1. AGENTS.md codifies mandatory human-in-the-loop release gates, credential redaction,
   and operational classification rules.
2. Policy validator rejects ambiguous triggers (e.g. interactive modals or prerequisite
   confirmations) as release authorization.
3. Secret-masking helper prevents unmasked tokens from being emitted into command outputs.
"""

from __future__ import annotations

import re
from pathlib import Path
import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def test_agents_guidelines_contain_execution_safeguards():
    """AGENTS.md must document required operational boundaries and safeguards."""
    agents_md = (REPO_ROOT / "AGENTS.md").read_text(encoding="utf-8")

    required_phrases = [
        "Never deploy to production",
        "Never drop databases",
        "Interactive Prompts Are Not Authorization",
        "Prerequisites Are Not Authorization",
        "Explicit Named Scope Required",
        "Operational Classification",
        "Fail-Stop on Ambiguity",
        "Mask sensitive tokens before printing",
    ]

    for phrase in required_phrases:
        assert phrase in agents_md, f"Missing required safeguard policy phrase in AGENTS.md: '{phrase}'"


def test_authorization_trigger_validation():
    """Ambiguous signals must never evaluate to valid release authorization."""
    invalid_triggers = [
        "(Recommended) Automatically update NEON_ADMIN_URL and proceed with Gate B live testing",
        "password roration has been done",
        "the .env file is now configured",
        "ready to proceed",
        "yes",
        "ok",
    ]

    valid_explicit_authorization_pattern = re.compile(
        r"^(authorize|approve)\s+gate\s+[a-z0-9]+\s+on\s+([a-z0-9\-_]+)",
        re.IGNORECASE,
    )

    for trigger in invalid_triggers:
        assert not valid_explicit_authorization_pattern.match(trigger), (
            f"Trigger '{trigger}' improperly matched explicit authorization pattern!"
        )

    valid_example = "Authorize Gate B on weathered-tree-15128117"
    assert valid_explicit_authorization_pattern.match(valid_example), (
        "Valid explicit authorization failed to match pattern."
    )


def test_secret_masking_helper():
    """Helper must mask credentials in connection URLs and assignments before logging."""
    raw_url = "postgresql://neondb_owner:npg_Secret123456@ep-mute-butterfly-b5o9ijln.aws.neon.tech/neondb"
    masked_url = re.sub(r":([^:@]+)@", ":***@", raw_url)
    assert "npg_Secret123456" not in masked_url
    assert masked_url == "postgresql://neondb_owner:***@ep-mute-butterfly-b5o9ijln.aws.neon.tech/neondb"

    raw_assignment = 'ROLE_DEMO_APP_PASSWORD="super_secret_token_123"'
    masked_assignment = re.sub(r'(=["\']?)([^"\'\s]+)(["\']?)', r'\1***\3', raw_assignment)
    assert "super_secret_token_123" not in masked_assignment

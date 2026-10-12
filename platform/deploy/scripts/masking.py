#!/usr/bin/env python3
"""
Structural Secret Masking and Safe Execution Engine (Task 017).

Provides structural redaction of credentials in:
- Database connection URLs (PostgreSQL, MySQL, HTTP/S).
- Environment key-value pairs (PASSWORD, SECRET, TOKEN, KEY).
- HTTP Authorization headers.
- Process exception tracebacks and logs.
- Subprocess command lines, stdout, and stderr.
"""

from __future__ import annotations

import re
import subprocess
import traceback
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit

SENSITIVE_KEY_PATTERN = re.compile(
    r"(?i)\b(password|secret|token|api[_-]?key|private[_-]?key|credential|auth)\b"
)
AUTH_HEADER_PATTERN = re.compile(
    r"(?i)(authorization:\s*(?:bearer|basic)\s+)[^\r\n]+",
)
KEY_VALUE_PATTERN = re.compile(
    r"(?i)\b([a-z0-9_-]*(?:password|secret|token|key|credential)[a-z0-9_-]*)\s*([=:])\s*([\"']?)([^\"'\s\r\n]+)([\"']?)",
)


def mask_database_url(url_str: str) -> str:
    """
    Structurally decomposes a URL using urlsplit and replaces credentials with ***.
    Preserves dialect scheme, host, port, dbname, and safe query parameters.
    """
    if not url_str or not isinstance(url_str, str):
        return url_str

    try:
        parsed = urlsplit(url_str)
        if not parsed.scheme or not parsed.netloc:
            # Fallback to regex if not a standard URL
            return re.sub(r":([^:@\s]+)@", ":***@", url_str)

        # Decompose netloc: [username[:password]@]host[:port]
        netloc = parsed.netloc
        user_pass, at_sign, host_port = netloc.rpartition("@")

        if at_sign:
            username, colon, password = user_pass.partition(":")
            if colon:
                masked_user_pass = f"{username}:***"
            else:
                masked_user_pass = username
            new_netloc = f"{masked_user_pass}@{host_port}"
        else:
            new_netloc = host_port

        # Filter query params for sensitive keys
        if parsed.query:
            qs = parse_qs(parsed.query, keep_blank_values=True)
            masked_qs: dict[str, list[str]] = {}
            for k, vals in qs.items():
                if SENSITIVE_KEY_PATTERN.search(k):
                    masked_qs[k] = ["***"] * len(vals)
                else:
                    masked_qs[k] = vals
            new_query = urlencode(masked_qs, doseq=True)
        else:
            new_query = ""

        return urlunsplit((parsed.scheme, new_netloc, parsed.path, new_query, parsed.fragment))
    except Exception:
        # Fail safe with regex
        return re.sub(r":([^:@\s]+)@", ":***@", url_str)


def mask_key_value(text: str) -> str:
    """
    Masks sensitive key-value pairs (e.g. POSTGRES_PASSWORD=secret or Authorization headers).
    """
    if not text or not isinstance(text, str):
        return text

    # Mask Authorization headers
    masked = AUTH_HEADER_PATTERN.sub(r"\1***", text)

    # Mask KEY=value assignments
    def _kv_repl(m: re.Match) -> str:
        k = m.group(1)
        sep = m.group(2)
        q1 = m.group(3)
        val = m.group(4)
        q2 = m.group(5)
        # Avoid double masking
        if val in ("***", "<REDACTED>"):
            return m.group(0)
        return f"{k}{sep}{q1}***{q2}"

    masked = KEY_VALUE_PATTERN.sub(_kv_repl, masked)
    return masked


def mask_text(text: str) -> str:
    """
    Applies comprehensive structural and pattern masking to arbitrary text (logs, json, traces).
    """
    if not text or not isinstance(text, str):
        return text

    # 1. Mask complete database URLs
    url_matches = re.findall(r"(?:[a-z0-9+.-]+)://[^\s\"']+", text)
    masked = text
    for u in set(url_matches):
        if "@" in u:
            masked = masked.replace(u, mask_database_url(u))

    # 2. Mask key-values and headers
    masked = mask_key_value(masked)

    # 3. Mask Age private keys
    masked = re.sub(r"AGE-SECRET-KEY-[A-Z0-9]+", "AGE-SECRET-KEY-***REDACTED***", masked)

    # 4. Mask PEM private keys
    masked = re.sub(
        r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----",
        "-----BEGIN PRIVATE KEY-----\n***REDACTED PRIVATE KEY***\n-----END PRIVATE KEY-----",
        masked,
    )

    return masked


def sanitize_exception(exc: Exception) -> str:
    """
    Returns a sanitized string representation of an exception and its traceback.
    """
    tb_str = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
    return mask_text(tb_str)


def safe_run_subprocess(
    cmd: list[str],
    mask_stdout: bool = True,
    mask_stderr: bool = True,
    **kwargs,
) -> subprocess.CompletedProcess[str]:
    """
    Subprocess execution wrapper that masks credentials in command logging,
    stdout, and stderr before exposing them to agent contexts.
    """
    sanitized_cmd = [mask_text(arg) for arg in cmd]
    kwargs.setdefault("text", True)
    kwargs.setdefault("capture_output", True)

    try:
        res = subprocess.run(cmd, **kwargs)
        stdout_clean = mask_text(res.stdout) if (mask_stdout and res.stdout) else res.stdout
        stderr_clean = mask_text(res.stderr) if (mask_stderr and res.stderr) else res.stderr

        return subprocess.CompletedProcess(
            args=sanitized_cmd,
            returncode=res.returncode,
            stdout=stdout_clean,
            stderr=stderr_clean,
        )
    except Exception as e:
        sanitized_err = sanitize_exception(e)
        raise RuntimeError(f"Subprocess failed with error: {sanitized_err}") from None

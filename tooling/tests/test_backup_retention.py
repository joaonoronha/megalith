"""
Unit tests for Megalith encrypted backup integrity, keypair generation,
and safe retention pruning policies (Task 010).
"""

from __future__ import annotations

import datetime
import json
import sys
import tempfile
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "platform" / "deploy" / "postgres"))

from backup import (  # type: ignore
    BackupError,
    DirectoryBackupStorage,
    RetentionError,
    compute_sha256,
    generate_keypair,
    prune_backups,
    retrieve_encrypted_backup,
    verify_backup_integrity,
)


@pytest.fixture
def temp_dir():
    with tempfile.TemporaryDirectory() as td:
        yield Path(td)


def test_age_keypair_generation(temp_dir: Path):
    key_path = temp_dir / "backup_key.txt"
    pub, path = generate_keypair(key_path)
    assert pub.startswith("age1")
    assert path.exists()
    assert (path.stat().st_mode & 0o077) == 0  # Mode 0600


def test_verify_backup_integrity_and_tamper_detection(temp_dir: Path):
    ciphertext_file = temp_dir / "backup-test-001.dump.age"
    meta_file = temp_dir / "backup-test-001.meta.json"

    ciphertext_file.write_bytes(b"Simulated encrypted payload bytes 1234567890")
    sha256 = compute_sha256(ciphertext_file)

    meta = {
        "schema_version": 1,
        "backup_id": "backup-test-001",
        "database": "db_demo",
        "ciphertext_file": ciphertext_file.name,
        "ciphertext_bytes": ciphertext_file.stat().st_size,
        "ciphertext_sha256": sha256,
        "verified_restorable": True,
    }
    meta_file.write_text(json.dumps(meta), encoding="utf-8")

    # Integrity passes
    res = verify_backup_integrity(ciphertext_file)
    assert res["backup_id"] == "backup-test-001"

    # Tamper with file (flip a byte)
    ciphertext_file.write_bytes(b"Simulated encrypted payload bytes 1234567891")
    with pytest.raises(BackupError, match="Backup integrity check failed"):
        verify_backup_integrity(ciphertext_file)


def test_retention_preserves_single_backup(temp_dir: Path):
    meta_file = temp_dir / "backup-001.meta.json"
    cipher_file = temp_dir / "backup-001.dump.age"
    cipher_file.write_bytes(b"data")
    meta_file.write_text(json.dumps({
        "backup_id": "backup-001",
        "ciphertext_file": "backup-001.dump.age",
        "created_at": "2026-01-01T00:00:00Z",
        "export_status": "verified",
        "verified_restorable": True,
    }), encoding="utf-8")

    pruned = prune_backups(temp_dir, keep_count=0, keep_days=0)
    assert len(pruned) == 0
    assert cipher_file.exists()


def test_retention_blocks_pruning_on_failed_latest_export(temp_dir: Path):
    # Old good backup
    (temp_dir / "backup-001.dump.age").write_bytes(b"good")
    (temp_dir / "backup-001.meta.json").write_text(json.dumps({
        "backup_id": "backup-001",
        "ciphertext_file": "backup-001.dump.age",
        "created_at": "2026-01-01T00:00:00Z",
        "export_status": "verified",
        "verified_restorable": True,
    }), encoding="utf-8")

    # Recent backup with failed export
    (temp_dir / "backup-002.dump.age").write_bytes(b"recent")
    (temp_dir / "backup-002.meta.json").write_text(json.dumps({
        "backup_id": "backup-002",
        "ciphertext_file": "backup-002.dump.age",
        "created_at": "2026-10-11T12:00:00Z",
        "export_status": "failed: destination unreachable",
        "verified_restorable": False,
    }), encoding="utf-8")

    with pytest.raises(RetentionError, match="Latest backup export failed"):
        prune_backups(temp_dir, keep_count=1, keep_days=1)


def test_retention_protects_last_verified_restorable_backup(temp_dir: Path):
    now = datetime.datetime.now(datetime.timezone.utc)
    old_date = (now - datetime.timedelta(days=30)).isoformat()

    # Backup 1: Old, but the ONLY verified restorable backup
    (temp_dir / "b1.dump.age").write_bytes(b"b1")
    (temp_dir / "b1.meta.json").write_text(json.dumps({
        "backup_id": "b1",
        "ciphertext_file": "b1.dump.age",
        "created_at": old_date,
        "export_status": "verified",
        "verified_restorable": True,
    }), encoding="utf-8")

    # Backup 2: Old, unverified
    (temp_dir / "b2.dump.age").write_bytes(b"b2")
    (temp_dir / "b2.meta.json").write_text(json.dumps({
        "backup_id": "b2",
        "ciphertext_file": "b2.dump.age",
        "created_at": old_date,
        "export_status": "verified",
        "verified_restorable": False,
    }), encoding="utf-8")

    # Backup 3: New, unverified
    (temp_dir / "b3.dump.age").write_bytes(b"b3")
    (temp_dir / "b3.meta.json").write_text(json.dumps({
        "backup_id": "b3",
        "ciphertext_file": "b3.dump.age",
        "created_at": now.isoformat(),
        "export_status": "verified",
        "verified_restorable": False,
    }), encoding="utf-8")

    # Prune with keep_count=1, keep_days=5
    # b3 is kept (top 1). b1 is kept because it's the last verified restorable backup. b2 is pruned.
    pruned = prune_backups(temp_dir, keep_count=1, keep_days=5, dry_run=False)
    assert "b2" in pruned
    assert "b1" not in pruned
    assert (temp_dir / "b1.dump.age").exists()
    assert not (temp_dir / "b2.dump.age").exists()


def test_directory_backup_storage_export_and_retrieval(temp_dir: Path):
    source_dir = temp_dir / "local"
    storage_dir = temp_dir / "offhost_storage"
    retrieve_dir = temp_dir / "retrieved"
    source_dir.mkdir()
    storage_dir.mkdir()
    retrieve_dir.mkdir()

    cipher_file = source_dir / "backup-test-dr.dump.age"
    meta_file = source_dir / "backup-test-dr.meta.json"
    cipher_file.write_bytes(b"Encrypted ciphertext block simulated data 987654321")
    sha256 = compute_sha256(cipher_file)

    meta_file.write_text(json.dumps({
        "schema_version": 1,
        "backup_id": "backup-test-dr",
        "database": "db_demo",
        "ciphertext_file": "backup-test-dr.dump.age",
        "ciphertext_bytes": cipher_file.stat().st_size,
        "ciphertext_sha256": sha256,
        "export_status": "local_only",
    }), encoding="utf-8")

    storage = DirectoryBackupStorage(storage_dir)

    # 1. Export
    info = storage.export_backup("backup-test-dr", cipher_file, meta_file)
    assert info["backend"] == "directory"
    assert info["verified_sha256"] == sha256
    assert (storage_dir / "backup-test-dr.dump.age").exists()
    assert (storage_dir / "backup-test-dr.meta.json").exists()

    # 2. List backups in storage
    b_list = storage.list_backups()
    assert "backup-test-dr" in b_list

    # 3. Simulate disaster loss: delete original local backup files completely
    cipher_file.unlink()
    meta_file.unlink()
    assert not cipher_file.exists()

    # 4. Retrieve into fresh location
    c_ret, m_ret = retrieve_encrypted_backup("backup-test-dr", storage, retrieve_dir)
    assert c_ret.is_file()
    assert m_ret.is_file()
    assert compute_sha256(c_ret) == sha256
    assert (c_ret.stat().st_mode & 0o077) == 0  # 0600 mode


def test_directory_backup_storage_corrupt_retrieval_rejected(temp_dir: Path):
    source_dir = temp_dir / "local"
    storage_dir = temp_dir / "offhost_storage"
    retrieve_dir = temp_dir / "retrieved"
    source_dir.mkdir()
    storage_dir.mkdir()
    retrieve_dir.mkdir()

    cipher_file = source_dir / "backup-corrupt.dump.age"
    meta_file = source_dir / "backup-corrupt.meta.json"
    cipher_file.write_bytes(b"Valid ciphertext bytes")
    sha256 = compute_sha256(cipher_file)

    meta_file.write_text(json.dumps({
        "schema_version": 1,
        "backup_id": "backup-corrupt",
        "ciphertext_file": "backup-corrupt.dump.age",
        "ciphertext_sha256": sha256,
    }), encoding="utf-8")

    storage = DirectoryBackupStorage(storage_dir)
    storage.export_backup("backup-corrupt", cipher_file, meta_file)

    # Corrupt ciphertext in storage
    storage_cipher = storage_dir / "backup-corrupt.dump.age"
    storage_cipher.write_bytes(b"Corrupted bytes in offhost storage!")

    # Attempt retrieval must fail closed
    with pytest.raises(BackupError, match="Retrieved backup checksum mismatch"):
        retrieve_encrypted_backup("backup-corrupt", storage, retrieve_dir)

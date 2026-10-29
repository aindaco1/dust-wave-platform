import datetime
import hashlib
import importlib.util
import io
import json
import shutil
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location("audit", Path(__file__).with_name("verify-recovery-archive.py"))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class ArchiveVerificationTests(unittest.TestCase):
    def archive(self, folder, product="store", extra=None, corrupt=False, unsafe=None):
        contents = {"manifest.json": json.dumps({"version": 2, "product": product}).encode(),
                    "kv/example.values.json": b'{"synthetic":"fixture"}'}
        checksums = {"artifacts": [{"path": name, "sha256": hashlib.sha256(body).hexdigest()}
                                    for name, body in contents.items()]}
        contents["checksums.json"] = json.dumps(checksums).encode()
        if corrupt:
            contents["kv/example.values.json"] = b'changed'
        if extra:
            contents[extra] = b'unlisted'
        destination = Path(folder) / "backup.tar.gz"
        with tarfile.open(destination, "w:gz") as target:
            for name, body in contents.items():
                entry = tarfile.TarInfo("./" + name)
                entry.size = len(body)
                target.addfile(entry, io.BytesIO(body))
            if unsafe:
                entry = tarfile.TarInfo(unsafe)
                entry.size = 1
                target.addfile(entry, io.BytesIO(b'x'))
        return destination

    def test_store_and_pool_snapshots_use_complete_checksum_inventory(self):
        for product in ["store", "pool"]:
            with self.subTest(product=product), tempfile.TemporaryDirectory() as directory:
                result = audit.verify_contents(self.archive(directory, product))
                self.assertTrue(result["ok"])
                self.assertEqual(result["checkedArtifacts"], 2)

    def test_modified_and_unlisted_files_fail_without_exposing_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            result = audit.verify_contents(self.archive(directory, extra="customer-private.txt", corrupt=True))
            self.assertFalse(result["ok"])
            self.assertEqual(result["unlistedFiles"], 1)
            self.assertEqual(result["checksumMismatches"], 1)
            self.assertNotIn("customer", json.dumps(result))

    def test_path_traversal_is_rejected_before_any_extraction(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, "unsafe_archive_path"):
                audit.verify_contents(self.archive(directory, unsafe="../escape"))
            self.assertFalse((Path(directory).parent / "escape").exists())

    def test_archive_expansion_is_bounded(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(audit, "MAX_BYTES", 1):
            with self.assertRaisesRegex(ValueError, "expanded_archive_exceeds_limit"):
                audit.verify_contents(self.archive(directory))

    def test_stale_and_future_receipts_cannot_look_current(self):
        now = datetime.datetime(2026, 10, 28, 18, tzinfo=datetime.timezone.utc)
        self.assertGreater(audit.receipt_age_hours({"createdAt": "2026-07-10T13:58:27Z"}, now), 4)
        with self.assertRaisesRegex(ValueError, "snapshot_timestamp_is_in_the_future"):
            audit.receipt_age_hours({"createdAt": "2027-01-01T00:00:00Z"}, now)

    def test_missing_credentials_never_start_a_provider_command(self):
        with patch.object(audit.subprocess, "run") as command:
            self.assertEqual(audit.run_audit({})["error"], "missing_protected_recovery_credentials")
            command.assert_not_called()

    def test_empty_and_paginated_archives_are_not_reported_as_verified(self):
        env = {"RECOVERY_ARCHIVE_URI": "s3://fixture-archive/store", "RECOVERY_ARCHIVE_ENDPOINT": "https://fixture.invalid",
               "RECOVERY_AGE_IDENTITY": "fixture", "AWS_ACCESS_KEY_ID": "fixture", "AWS_SECRET_ACCESS_KEY": "fixture",
               "RECOVERY_ARCHIVE_NAME": "store-backup.tar.gz.age"}
        for listing, reason in [({}, "no_captured_snapshot_receipt"), ({"NextToken": "more"}, "archive_inventory_exceeds_audit_limit")]:
            with self.subTest(reason=reason), patch.object(audit.subprocess, "run", return_value=type("Result", (), {"returncode": 0, "stdout": json.dumps(listing).encode()})()) as command:
                self.assertEqual(audit.run_audit(env)["error"], reason)
                self.assertEqual(command.call_count, 1)
                self.assertIn("list-objects-v2", command.call_args.args[0])

    def test_complete_audit_reads_only_archive_and_outputs_no_contents(self):
        with tempfile.TemporaryDirectory() as directory:
            plaintext = self.archive(directory)
            ciphertext = b'encrypted-fixture'
            timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
            receipt = {"encrypted": True, "createdAt": timestamp, "archive": "pool-backup.tar.gz.age",
                       "archiveBytes": len(ciphertext), "archiveSha256": hashlib.sha256(ciphertext).hexdigest()}
            objects = [{"Key": "pool/run/manifest.json", "Size": 500, "LastModified": timestamp},
                       {"Key": "pool/run/pool-backup.tar.gz.age", "Size": len(ciphertext), "LastModified": timestamp}]
            calls = []

            def execute(args, **kwargs):
                calls.append(args)
                if "list-objects-v2" in args:
                    return SimpleNamespace(returncode=0, stdout=json.dumps({"Contents": objects}).encode())
                if args[0] == "aws":
                    self.assertEqual(args[3:5], ["s3", "cp"])
                    self.assertTrue(args[5].startswith("s3://fixture-archive/pool/"))
                    self.assertFalse(args[6].startswith("s3://"))
                    Path(args[6]).write_bytes(json.dumps(receipt).encode() if args[5].endswith("manifest.json") else ciphertext)
                else:
                    self.assertEqual(args[:2], ["age", "--decrypt"])
                    shutil.copyfile(plaintext, args[5])
                return SimpleNamespace(returncode=0, stdout=b'')

            env = {"RECOVERY_ARCHIVE_URI": "s3://fixture-archive/pool", "RECOVERY_ARCHIVE_ENDPOINT": "https://fixture.invalid",
                   "RECOVERY_AGE_IDENTITY": "private-key-fixture", "AWS_ACCESS_KEY_ID": "fixture", "AWS_SECRET_ACCESS_KEY": "fixture",
                   "RECOVERY_ARCHIVE_NAME": "pool-backup.tar.gz.age"}
            with patch.object(audit.subprocess, "run", side_effect=execute):
                result = audit.run_audit(env)
            self.assertEqual(result["status"], "PASS")
            self.assertTrue(result["internalIntegrity"]["ok"])
            self.assertEqual(len(calls), 4)
            self.assertNotIn("private-key-fixture", json.dumps(result))
            self.assertNotIn("synthetic", json.dumps(result))


if __name__ == "__main__":
    unittest.main()

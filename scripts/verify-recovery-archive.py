#!/usr/bin/env python3
"""Read-only S3/age backup audit. Never print archive contents or credentials."""
import datetime
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import tarfile
import tempfile
from urllib.parse import urlparse

MAX_BYTES = 2 * 1024 ** 3
MAX_LIST_PAGES = 10


def safe_path(value):
    if not isinstance(value, str) or not value or "\\" in value:
        raise ValueError("unsafe_archive_path")
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or any(ord(c) < 32 for c in value):
        raise ValueError("unsafe_archive_path")
    return str(path)


def verify_contents(archive, require_captured_data=False, require_r2=False):
    hashes, documents, expanded = {}, {}, 0
    with tarfile.open(archive, "r:gz") as source:
        for member in source:
            name = safe_path(member.name)
            if member.isdir():
                continue
            if not member.isfile() or name in hashes:
                raise ValueError("unsupported_or_duplicate_archive_entry")
            expanded += member.size
            if expanded > MAX_BYTES:
                raise ValueError("expanded_archive_exceeds_limit")
            with source.extractfile(member) as stream:
                if PurePosixPath(name).name in ("manifest.json", "checksums.json", "plan.json"):
                    if member.size > 16 * 1024 ** 2:
                        raise ValueError("manifest_exceeds_limit")
                    body = stream.read()
                    hashes[name] = hashlib.sha256(body).hexdigest()
                    documents[name] = json.loads(body)
                else:
                    hashes[name] = hashlib.file_digest(stream, "sha256").hexdigest()
    roots = [name[:-len("checksums.json")] for name in documents
             if name.endswith("checksums.json") and name[:-len("checksums.json")] + "manifest.json" in documents]
    if len(roots) != 1:
        raise ValueError("ambiguous_or_missing_snapshot_manifest")
    root = roots[0]
    manifest = documents[root + "manifest.json"]
    if manifest.get("version") != 2:
        raise ValueError("unsupported_snapshot_version")
    expected = {}
    for entry in documents[root + "checksums.json"].get("artifacts", []):
        name = root + safe_path(entry["path"])
        if name in expected:
            raise ValueError("duplicate_checksum_entry")
        expected[name] = entry["sha256"]
    if not expected:
        raise ValueError("empty_checksum_inventory")
    unlisted = set(hashes) - set(expected) - {root + "checksums.json"}
    missing = set(expected) - set(hashes)
    mismatched = [name for name in set(expected) & set(hashes) if expected[name] != hashes[name]]
    result = {"ok": not (unlisted or missing or mismatched), "checkedArtifacts": len(expected),
              "unlistedFiles": len(unlisted), "missingFiles": len(missing), "checksumMismatches": len(mismatched)}
    if require_captured_data:
        plan = documents.get(root + "kv/plan.json", [])
        required = [item for item in plan if item.get("valuesFile")]
        captured = manifest.get("kvValueCapture", [])
        def family(item):
            return (item.get("binding"), item.get("familyId") or item.get("prefix"))
        # Store capture entries omit binding; its plan has one STORE_STATE binding.
        coverage = {(item.get("binding", "STORE_STATE"), item.get("familyId") or item.get("prefix"))
                    for item in captured if item.get("complete") is True}
        complete = (manifest.get("remote") is True and manifest.get("includesKvValues") is True
                    and bool(required) and all(family(item) in coverage and root + safe_path(item["valuesFile"]) in expected
                                               for item in required)
                    and any(name.endswith(".bundle") and name.startswith(root + "git/") for name in expected))
        result["capturedKvFamilies"] = len(required)
        if require_r2:
            r2 = manifest.get("r2", {})
            complete = complete and (manifest.get("includesR2Objects") is True
                and r2.get("completeInventory") is True and r2.get("objectsDownloaded") is True
                and r2.get("objectsDownloadedCount") == r2.get("totalDiscoveredObjects"))
            result["capturedR2Objects"] = r2.get("objectsDownloadedCount", 0)
        result["captureComplete"] = bool(complete)
        result["ok"] = result["ok"] and result["captureComplete"]
    return result


def receipt_age_hours(receipt, now):
    date = datetime.datetime.fromisoformat(str(receipt.get("createdAt", "")).replace("Z", "+00:00"))
    if date.tzinfo is None:
        raise ValueError("snapshot_timestamp_has_no_timezone")
    age = (now - date).total_seconds() / 3600
    if age < -0.02:
        raise ValueError("snapshot_timestamp_is_in_the_future")
    return max(0, age)


def verify_snapshot(receipt, encrypted, env, folder, command, now=None):
    """Verify local ciphertext and captured inventory without extracting files."""
    now = now or datetime.datetime.now(datetime.timezone.utc)
    result = {"status": "FAIL"}
    if receipt.get("encrypted") is not True or receipt.get("archive") != env["RECOVERY_ARCHIVE_NAME"]:
        return {**result, "error": "not_expected_encrypted_snapshot"}
    size = encrypted.stat().st_size
    if not 0 < size <= MAX_BYTES or size != receipt.get("archiveBytes"):
        return {**result, "error": "archive_missing_or_size_invalid"}
    age = receipt_age_hours(receipt, now)
    maximum_age = float(env.get("RECOVERY_MAX_AGE_HOURS", "4"))
    result.update({"snapshotCreatedAt": receipt["createdAt"], "ageHours": round(age, 2),
                   "maximumAgeHours": maximum_age, "current": age <= maximum_age})
    with encrypted.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    result["archiveChecksumMatches"] = digest == receipt.get("archiveSha256")
    if not result["archiveChecksumMatches"]:
        return {**result, "error": "encrypted_archive_checksum_mismatch"}
    identity, decrypted = folder / "identity.txt", folder / "backup.tar.gz"
    try:
        identity.write_text(env["RECOVERY_AGE_IDENTITY"] + "\n")
        identity.chmod(0o600)
        command(["age", "--decrypt", "--identity", str(identity), "--output", str(decrypted), str(encrypted)])
        result["decryptable"] = True
        result["internalIntegrity"] = verify_contents(decrypted,
            require_captured_data=env.get("RECOVERY_REQUIRE_CAPTURED_DATA") == "true",
            require_r2=env.get("RECOVERY_REQUIRE_R2") == "true")
        result["status"] = "PASS" if result["current"] and result["internalIntegrity"]["ok"] else "FAIL"
        return result
    finally:
        identity.unlink(missing_ok=True)
        decrypted.unlink(missing_ok=True)


def run_audit(env):
    now = datetime.datetime.now(datetime.timezone.utc)
    result = {"verifiedAt": now.isoformat(), "productionWrites": False, "status": "FAIL"}
    required = ("RECOVERY_ARCHIVE_URI", "RECOVERY_ARCHIVE_ENDPOINT", "RECOVERY_AGE_IDENTITY",
                "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "RECOVERY_ARCHIVE_NAME")
    if any(not env.get(key) for key in required):
        return {**result, "error": "missing_protected_recovery_credentials"}
    uri = urlparse(env["RECOVERY_ARCHIVE_URI"])
    endpoint = urlparse(env["RECOVERY_ARCHIVE_ENDPOINT"])
    if uri.scheme != "s3" or uri.query or uri.fragment or not re.fullmatch(r"[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]", uri.netloc):
        return {**result, "error": "invalid_archive_destination"}
    prefix = safe_path(uri.path.strip("/")) + "/"
    archive_name = safe_path(env["RECOVERY_ARCHIVE_NAME"])
    if "/" in archive_name or not archive_name.endswith(".tar.gz.age"):
        return {**result, "error": "invalid_expected_archive_name"}
    if endpoint.scheme != "https" or not endpoint.hostname or endpoint.path not in ("", "/") or endpoint.username or endpoint.password or endpoint.query or endpoint.fragment:
        return {**result, "error": "invalid_archive_endpoint"}
    maximum_age = float(env.get("RECOVERY_MAX_AGE_HOURS", "4"))
    if not 0 < maximum_age <= 168:
        return {**result, "error": "invalid_snapshot_age_limit"}

    def command(args):
        process = subprocess.run(args, env=env, capture_output=True, timeout=300)
        if process.returncode:
            raise ValueError("archive_read_or_decryption_failed")
        return process.stdout

    aws = ["aws", "--endpoint-url", env["RECOVERY_ARCHIVE_ENDPOINT"]]
    objects, token, seen = [], "", set()
    for page in range(MAX_LIST_PAGES):
        listing = json.loads(command(aws + ["s3api", "list-objects-v2", "--bucket", uri.netloc,
                            "--prefix", prefix, "--max-keys", "1000", "--no-paginate", "--output", "json"]
                            + (["--continuation-token", token] if token else [])))
        objects.extend(listing.get("Contents", []))
        if not listing.get("IsTruncated") and not listing.get("NextToken"):
            break
        token = listing.get("NextContinuationToken", "")
        if not token or token in seen or page + 1 == MAX_LIST_PAGES:
            return {**result, "error": "archive_inventory_exceeds_audit_limit"}
        seen.add(token)
    receipts = [item for item in objects if item["Key"].startswith(prefix) and item["Key"].endswith("/manifest.json")]
    result.update({"listedObjects": len(objects), "snapshotReceipts": len(receipts)})
    if not receipts:
        return {**result, "error": "no_captured_snapshot_receipt"}
    newest = max(receipts, key=lambda item: item["LastModified"])
    if newest["Size"] > 1024 ** 2:
        return {**result, "error": "receipt_exceeds_limit"}
    with tempfile.TemporaryDirectory(prefix="recovery-archive-audit-") as temporary:
        folder = Path(temporary)
        receipt_file = folder / "manifest.json"
        location = "s3://" + uri.netloc + "/"
        command(aws + ["s3", "cp", location + safe_path(newest["Key"]), str(receipt_file), "--only-show-errors"])
        receipt = json.loads(receipt_file.read_text())
        archive_key = newest["Key"][:-len("manifest.json")] + archive_name
        stored = next((item for item in objects if item["Key"] == archive_key), None)
        if not stored or not 0 < stored["Size"] <= MAX_BYTES or stored["Size"] != receipt.get("archiveBytes"):
            return {**result, "error": "archive_missing_or_size_invalid"}
        encrypted = folder / archive_name
        command(aws + ["s3", "cp", location + safe_path(archive_key), str(encrypted), "--only-show-errors"])
        result.update(verify_snapshot(receipt, encrypted, env, folder, command, now))
    return result


if __name__ == "__main__":
    os.umask(0o077)
    try:
        evidence = run_audit(dict(os.environ))
    except Exception as error:
        # Only fixed categories are public; provider output and file names stay private.
        category = str(error) if isinstance(error, ValueError) and re.fullmatch(r"[a-z_]+", str(error)) else "archive_verification_failed"
        evidence = {"status": "FAIL", "error": category, "productionWrites": False}
    output = Path(os.environ["RECOVERY_EVIDENCE_OUTPUT"])
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(evidence, indent=2) + "\n")
    print(json.dumps(evidence))
    raise SystemExit(0 if evidence["status"] == "PASS" else 1)

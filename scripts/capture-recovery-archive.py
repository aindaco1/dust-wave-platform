#!/usr/bin/env python3
"""Capture with the consumer's existing tool, then publish and verify ciphertext only."""
import datetime
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from urllib.parse import urlparse
import uuid

spec = importlib.util.spec_from_file_location('audit', Path(__file__).with_name('verify-recovery-archive.py'))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def capture(env, capture_command):
    required = ('RECOVERY_ARCHIVE_URI', 'RECOVERY_ARCHIVE_ENDPOINT', 'RECOVERY_ARCHIVE_ACCOUNT_ID',
                'CLOUDFLARE_ACCOUNT_ID', 'RECOVERY_AGE_IDENTITY', 'RECOVERY_IDENTITY_VARIABLE',
                'RECOVERY_ARCHIVE_NAME', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY')
    if any(not env.get(key) for key in required) or not capture_command:
        raise ValueError('missing_backup_configuration')
    identity_variable = env['RECOVERY_IDENTITY_VARIABLE']
    if not re.fullmatch(r'[A-Z][A-Z0-9_]*_AGE_IDENTITY', identity_variable):
        raise ValueError('invalid_identity_variable')
    account = env['RECOVERY_ARCHIVE_ACCOUNT_ID']
    uri = urlparse(env['RECOVERY_ARCHIVE_URI'])
    endpoint = env['RECOVERY_ARCHIVE_ENDPOINT'].rstrip('/')
    if (not re.fullmatch(r'[a-f0-9]{32}', account) or account == env['CLOUDFLARE_ACCOUNT_ID']
            or endpoint != f'https://{account}.r2.cloudflarestorage.com'):
        raise ValueError('archive_must_use_existing_separate_r2_account')
    if (uri.scheme != 's3' or not re.fullmatch(r'[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]', uri.netloc)
            or not uri.path.strip('/') or uri.query or uri.fragment):
        raise ValueError('invalid_archive_destination')
    audit.safe_path(uri.path.strip('/'))
    name = audit.safe_path(env['RECOVERY_ARCHIVE_NAME'])
    if '/' in name or not name.endswith('.tar.gz.age'):
        raise ValueError('invalid_expected_archive_name')
    evidence = {'status': 'FAIL', 'productionWrites': False, 'archiveWrites': False}

    def command(args, child_env=env, timeout=300, stage='archive_verification'):
        result = subprocess.run(args, env=child_env, capture_output=True, timeout=timeout)
        if result.returncode:
            detail = (result.stderr or b'').decode(errors='replace')
            categories = [('KV key inventory', 'kv_inventory_capture_failed'),
                          ('KV value capture', 'kv_values_capture_failed'),
                          ('R2 object inventory', 'r2_inventory_capture_failed'),
                          ('R2 object capture', 'r2_values_capture_failed'),
                          ('decryptability', 'snapshot_decryption_failed'),
                          ('Unable to archive sensitive snapshot', 'snapshot_archive_failed'),
                          ('Unable to encrypt sensitive snapshot', 'snapshot_encryption_failed')]
            raise ValueError(next((category for phrase, category in categories if phrase in detail), stage + '_command_failed'))
        return result.stdout

    with tempfile.TemporaryDirectory(prefix='encrypted-backup-', dir=env.get('RUNNER_TEMP')) as temporary:
        folder = Path(temporary)
        identity = folder / 'capture-identity.txt'
        identity.write_text(env['RECOVERY_AGE_IDENTITY'] + '\n')
        identity.chmod(0o600)
        output = folder / 'snapshot'
        print('Capturing encrypted snapshot.', flush=True)
        command([*capture_command, '--output=' + str(output), '--encryption-backend=age'],
                {**env, identity_variable: str(identity)}, timeout=2700, stage='snapshot_capture')
        receipt = json.loads((output / 'manifest.json').read_text())
        verification_env = {**env, 'RECOVERY_REQUIRE_CAPTURED_DATA': 'true', 'RECOVERY_MAX_AGE_HOURS': '4'}
        print('Verifying captured data and local ciphertext.', flush=True)
        local = audit.verify_snapshot(receipt, output / name, verification_env, folder, command)
        if local['status'] != 'PASS':
            return {**evidence, 'error': 'local_capture_verification_failed', 'verification': local}
        # Never reuse a run prefix, including retries. Publish the receipt last so incomplete uploads are not selected.
        run = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex
        destination = env['RECOVERY_ARCHIVE_URI'].rstrip('/') + '/' + run
        aws = ['aws', '--endpoint-url', endpoint, 's3', 'cp']
        print('Uploading verified ciphertext and receipt.', flush=True)
        command(aws + [str(output / name), destination + '/' + name, '--only-show-errors'], stage='archive_upload')
        command(aws + [str(output / 'manifest.json'), destination + '/manifest.json', '--only-show-errors'], stage='receipt_upload')
        evidence.update({'archiveWrites': True, 'snapshotWarningCount': receipt.get('warningCount', 0),
                         'snapshotDurationMs': receipt.get('durationMs', 0)})
        print('Downloading and verifying the uploaded R2 snapshot.', flush=True)
        remote = audit.run_audit({**verification_env, 'RECOVERY_ARCHIVE_URI': destination})
        evidence.update({'status': remote['status'], 'verification': remote})
        return evidence


if __name__ == '__main__':
    os.umask(0o077)
    try:
        result = capture(dict(os.environ), sys.argv[1:])
    except Exception as error:
        category = str(error) if isinstance(error, ValueError) and re.fullmatch(r'[a-z_]+', str(error)) else 'backup_capture_failed'
        result = {'status': 'FAIL', 'error': category, 'productionWrites': False}
    output = Path(os.environ['RECOVERY_EVIDENCE_OUTPUT'])
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))
    raise SystemExit(0 if result['status'] == 'PASS' else 1)

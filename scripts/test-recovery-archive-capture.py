import datetime
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location('capture', Path(__file__).with_name('capture-recovery-archive.py'))
capture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(capture)


class CapturedDataTests(unittest.TestCase):
    def make_archive(self, folder, product='store', incomplete=None):
        family = {'binding': 'STORE_STATE', 'prefix': 'orders:'} if product == 'store' else {'binding': 'PLEDGES', 'familyId': 'pledges'}
        captured = {**family, 'complete': True, 'keys': 1}
        if product == 'store':
            captured.pop('binding')
        plan = [{**family, 'valuesFile': 'kv/values.json'}]
        manifest = {'version': 2, 'remote': True, 'includesKvValues': True, 'kvValueCapture': [captured],
                    'includesR2Objects': True, 'r2': {'completeInventory': True, 'objectsDownloaded': True,
                        'objectsDownloadedCount': 1, 'totalDiscoveredObjects': 1}}
        if incomplete == 'metadata': manifest['includesKvValues'] = False
        if incomplete == 'family': manifest['kvValueCapture'] = []
        if incomplete == 'r2': manifest['r2']['completeInventory'] = False
        contents = {'manifest.json': json.dumps(manifest).encode(), 'kv/plan.json': json.dumps(plan).encode(),
                    'kv/values.json': b'{"fixture":"synthetic"}', 'git/source.bundle': b'git fixture'}
        if incomplete == 'values': contents.pop('kv/values.json')
        if incomplete == 'git': contents.pop('git/source.bundle')
        contents['checksums.json'] = json.dumps({'artifacts': [
            {'path': k, 'sha256': hashlib.sha256(v).hexdigest()} for k, v in contents.items()]}).encode()
        target = Path(folder) / 'test.tar.gz'
        with tarfile.open(target, 'w:gz') as archive:
            for name, data in contents.items():
                entry = tarfile.TarInfo('./' + name)
                entry.size = len(data)
                archive.addfile(entry, io.BytesIO(data))
        return target

    def test_required_values_and_store_downloads_must_be_captured(self):
        for product in ('store', 'pool'):
            for missing in (None, 'metadata', 'family', 'values', 'git', 'r2'):
                with self.subTest(product=product, missing=missing), tempfile.TemporaryDirectory() as folder:
                    result = capture.audit.verify_contents(self.make_archive(folder, product, missing),
                        require_captured_data=True, require_r2=product == 'store')
                    self.assertEqual(result['ok'], missing is None or (product == 'pool' and missing == 'r2'))

    def test_archive_inventory_paginates_without_silently_ignoring_later_snapshots(self):
        env = CaptureTests().env()
        pages = [{'Contents': [], 'IsTruncated': True, 'NextContinuationToken': 'next'}, {'Contents': []}]
        with patch.object(capture.audit.subprocess, 'run', side_effect=[SimpleNamespace(returncode=0, stdout=json.dumps(p).encode()) for p in pages]) as run:
            result = capture.audit.run_audit(env)
        self.assertEqual(result['error'], 'no_captured_snapshot_receipt')
        self.assertEqual(run.call_count, 2)
        self.assertIn('--continuation-token', run.call_args.args[0])


class CaptureTests(unittest.TestCase):
    def env(self):
        return {'RECOVERY_ARCHIVE_URI': 's3://fixture-archive/store',
                'RECOVERY_ARCHIVE_ENDPOINT': 'https://' + 'a' * 32 + '.r2.cloudflarestorage.com',
                'RECOVERY_ARCHIVE_ACCOUNT_ID': 'a' * 32, 'CLOUDFLARE_ACCOUNT_ID': 'b' * 32,
                'RECOVERY_AGE_IDENTITY': 'synthetic-secret', 'RECOVERY_IDENTITY_VARIABLE': 'STORE_BACKUP_AGE_IDENTITY',
                'RECOVERY_ARCHIVE_NAME': 'store-backup.tar.gz.age', 'AWS_ACCESS_KEY_ID': 'synthetic', 'AWS_SECRET_ACCESS_KEY': 'synthetic'}

    def exercise(self, local='PASS', remote='PASS', fail_upload=False, capture_failure=''):
        calls, folders = [], []
        def execute(args, **kwargs):
            calls.append(args)
            if args[0] == 'node':
                target = Path(next(arg.split('=', 1)[1] for arg in args if arg.startswith('--output=')))
                folders.append(target.parent)
                identity = Path(kwargs['env']['STORE_BACKUP_AGE_IDENTITY'])
                self.assertEqual(identity.stat().st_mode & 0o777, 0o600)
                self.assertEqual(identity.read_text().strip(), 'synthetic-secret')
                target.mkdir()
                (target / 'manifest.json').write_text(json.dumps({'warningCount': 0}))
                (target / 'store-backup.tar.gz.age').write_bytes(b'ciphertext')
            return SimpleNamespace(returncode=1 if (fail_upload and args[0] == 'aws') or (capture_failure and args[0] == 'node') else 0, stdout=b'', stderr=capture_failure.encode())
        try:
            with patch.object(capture.subprocess, 'run', side_effect=execute), patch.object(capture.audit, 'verify_snapshot', return_value={'status': local}), patch.object(capture.audit, 'run_audit', return_value={'status': remote}) as audit:
                result = capture.capture(self.env(), ['node', 'scripts/existing-backup.mjs', '--remote', '--kv-values'])
                if local == 'PASS' and not fail_upload:
                    self.assertEqual(audit.call_args.args[0]['RECOVERY_REQUIRE_CAPTURED_DATA'], 'true')
                    self.assertNotEqual(audit.call_args.args[0]['RECOVERY_ARCHIVE_URI'], self.env()['RECOVERY_ARCHIVE_URI'])
                return result, calls
        finally:
            for folder in folders: self.assertFalse(folder.exists())

    def test_publishes_only_ciphertext_and_receipt_then_verifies_remote_copy(self):
        result, calls = self.exercise()
        self.assertEqual(result['status'], 'PASS')
        self.assertEqual(len(calls), 3)
        self.assertTrue(calls[1][-2].endswith('/store-backup.tar.gz.age'))
        self.assertTrue(calls[2][-2].endswith('/manifest.json'))
        self.assertNotIn('synthetic-secret', json.dumps(calls))
        self.assertFalse(result['productionWrites'])

    def test_incomplete_local_capture_is_never_uploaded(self):
        result, calls = self.exercise(local='FAIL')
        self.assertEqual(result['status'], 'FAIL')
        self.assertEqual(len(calls), 1)

    def test_remote_verification_failure_is_not_success(self):
        result, _ = self.exercise(remote='FAIL')
        self.assertEqual(result['status'], 'FAIL')

    def test_failed_archive_upload_does_not_publish_receipt_and_cleans_plaintext(self):
        with self.assertRaisesRegex(ValueError, 'archive_upload_command_failed'):
            self.exercise(fail_upload=True)

    def test_capture_failures_report_a_fixed_category_without_provider_output(self):
        for detail, category in [('Unable to archive sensitive snapshot. private-customer-value', 'snapshot_archive_failed'),
                                 ('Unable to encrypt sensitive snapshot. private-key-value', 'snapshot_encryption_failed'),
                                 ('unknown private-customer-value', 'snapshot_capture_command_failed')]:
            with self.subTest(category=category), self.assertRaisesRegex(ValueError, '^' + category + '$'):
                self.exercise(capture_failure=detail)

    def test_production_archive_or_missing_credentials_fail_before_capture(self):
        for change in ({'RECOVERY_ARCHIVE_ACCOUNT_ID': 'b' * 32}, {'RECOVERY_AGE_IDENTITY': ''}, {'RECOVERY_ARCHIVE_URI': 's3://fixture-archive/../escape'}):
            with self.subTest(change=change), patch.object(capture.subprocess, 'run') as run, self.assertRaises(ValueError):
                capture.capture({**self.env(), **change}, ['node', 'backup.mjs'])
            run.assert_not_called()


if __name__ == '__main__':
    unittest.main()

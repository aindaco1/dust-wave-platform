#!/usr/bin/env python3
"""One-time provisioning: seal only backup credentials to GitHub's target environment key."""
import base64
import json
import os
from pathlib import Path

# No production/admin/payment credentials are copied. GitHub alone can decrypt these envelopes.
NAMES = ('RECOVERY_AGE_IDENTITY', 'RECOVERY_ENCRYPTION_RECIPIENT', 'RECOVERY_ARCHIVE_URI',
         'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY')


def seal(env):
    from nacl.public import PublicKey, SealedBox
    if any(not env.get(name) for name in (*NAMES, 'BACKUP_ENV_PUBLIC_KEY', 'BACKUP_ENV_KEY_ID')):
        raise ValueError('missing_backup_provisioning_configuration')
    key = PublicKey(base64.b64decode(env['BACKUP_ENV_PUBLIC_KEY'], validate=True))
    box = SealedBox(key)
    return {'environment': 'production-backup', 'key_id': env['BACKUP_ENV_KEY_ID'],
            'secrets': {name: base64.b64encode(box.encrypt(env[name].encode())).decode() for name in NAMES}}


if __name__ == '__main__':
    os.umask(0o077)
    try:
        sealed = seal(os.environ)
        Path(os.environ['BACKUP_SEALED_OUTPUT']).write_text(json.dumps(sealed) + '\n')
        print('Five backup credentials sealed to the production-backup GitHub environment key.')
    except Exception:
        raise SystemExit('Backup credential provisioning failed; no credential values were logged.')

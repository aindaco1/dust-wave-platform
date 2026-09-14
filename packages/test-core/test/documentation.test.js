import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkDocumentation } from '../src/documentation.js';

test('documentation engine preserves anchors, fences, encoded links and consumer policies', t => {
  const root = mkdtempSync(join(tmpdir(), 'platform-docs-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'docs'));
  const file = join(root, 'README.md');
  writeFileSync(join(root, 'docs/Guide Notes.md'), '# Café\n## Recovery\n## Recovery\n## Recovery-1\n');
  writeFileSync(file, '[A](docs/Guide%20Notes.md#caf%C3%A9) [B](docs/Guide%20Notes.md#recovery-1-1)\n````md\n```\n[example](missing)\n```\n````\n[remote](https://example.test)\n');
  const options = { root, files: [file] };
  assert.deepEqual(checkDocumentation(options), { errors: [], markdownFileCount: 1, localLinkCount: 2 });
  writeFileSync(file, '[bad](#absent) [escape](../outside.md) [invalid](%ZZ)');
  assert.throws(() => checkDocumentation(options), URIError);
  assert.deepEqual(checkDocumentation({ ...options, requiredFiles: ['required.md'], restrictToRoot: true,
    malformedLinks: 'report', anchorError: 'broken heading anchor', validateSource: (_source, label) => [`${label}: custom policy`] }).errors, [
    'Missing required documentation: required.md', 'README.md: custom policy',
    'README.md: broken heading anchor #absent', 'README.md: local link leaves repository: ../outside.md', 'README.md: invalid local link %ZZ'
  ]);
  assert.throws(() => checkDocumentation({ ...options, malformedLinks: 'ignore' }), TypeError);
});

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, resolve, sep } from 'node:path';

function inside(root, path) {
  assert.ok(typeof path === 'string' && path && !isAbsolute(path), 'Expected a repository-relative path');
  const result = resolve(root, path);
  assert.ok(result.startsWith(`${resolve(root)}${sep}`), `Path leaves root: ${path}`);
  return result;
}

/** Node-only assertion. Checks the staged gitlink and initialized checkout; never fetches or advances a pin. */
export function assertConsumerPin({ root, submodulePath = 'shared/dust-wave-platform', expectedCommit,
  expectedRemote = 'https://github.com/aindaco1/dust-wave-platform.git', packages, lockfiles = [] }) {
  assert.match(expectedCommit, /^[a-f0-9]{40}$/, 'Expected a full immutable commit');
  assert.ok(packages && Object.keys(packages).length > 0, 'Expected explicit package versions');
  const git = (cwd, args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const submodule = inside(root, submodulePath);
  assert.equal(realpathSync(git(submodule, ['rev-parse', '--show-toplevel'])), realpathSync(submodule), 'Submodule must be initialized');
  assert.equal(git(submodule, ['rev-parse', 'HEAD']), expectedCommit, 'Submodule checkout differs from expected pin');
  const entry = git(root, ['ls-files', '--stage', '--', submodulePath]);
  assert.equal(entry, `160000 ${expectedCommit} 0\t${submodulePath}`, 'Staged gitlink differs from expected pin');
  const paths = git(root, ['config', '-f', '.gitmodules', '--get-regexp', '^submodule\\..*\\.path$']).split('\n');
  const matches = paths.filter(line => line.slice(line.indexOf(' ') + 1) === submodulePath);
  assert.equal(matches.length, 1, 'Expected one submodule path declaration');
  const urlKey = matches[0].slice(0, matches[0].indexOf(' ')).replace(/\.path$/, '.url');
  assert.equal(git(root, ['config', '-f', '.gitmodules', '--get', urlKey]), expectedRemote, 'Unexpected submodule remote');
  for (const [directory, version] of Object.entries(packages)) {
    assert.match(version, /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/, 'Expected an exact package version');
    const manifest = JSON.parse(readFileSync(inside(submodule, `packages/${directory}/package.json`), 'utf8'));
    assert.equal(manifest.version, version, `${directory} package version`);
  }
  for (const { path, packages: entries } of lockfiles) {
    const lock = JSON.parse(readFileSync(inside(root, path), 'utf8'));
    for (const [key, version] of Object.entries(entries)) {
      assert.equal(lock.packages?.[key]?.version, version, `${path}: ${key} locked version`);
    }
  }
}

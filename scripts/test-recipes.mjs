import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Exercise a fresh consumer checkout of the committed candidate, never a moving
// remote branch. Package unit tests separately cover uncommitted source changes.
const source = fileURLToPath(new URL('..', import.meta.url));
const run = (cwd, command, args) => execFileSync(command, args, {
  cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300_000,
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
});
const git = (cwd, ...args) => run(cwd, 'git', args).trim();
const pin = git(source, 'rev-parse', 'HEAD');
const templatePin = '351281a5aec60fa85653a3d23391e66fb860aae6';
const templateRemote = 'https://github.com/aindaco1/dust-wave-jekyll-template.git';
const recipes = process.argv.includes('--jekyll') ? ['jekyll-site'] : ['worker-admin', 'scheduled-digest'];
for (const name of recipes) {
  const root = mkdtempSync(join(tmpdir(), 'dustwave-recipe-'));
  try {
    git(root, 'init', '--quiet');
    git(root, '-c', 'protocol.file.allow=always', 'submodule', 'add', '--quiet', source, 'shared/dust-wave-platform');
    git(root, 'config', '-f', '.gitmodules', 'submodule.shared/dust-wave-platform.url', 'https://github.com/aindaco1/dust-wave-platform.git');
    git(join(root, 'shared/dust-wave-platform'), 'checkout', '--detach', pin);
    cpSync(resolve(root, 'shared/dust-wave-platform/examples/recipes', name), root, { recursive: true });
    writeFileSync(join(root, 'platform-commit.txt'), pin + '\n');
    git(root, 'add', '.gitmodules', 'shared/dust-wave-platform');
    run(root, 'npm', ['ci', '--offline', '--ignore-scripts']);
    if (name === 'jekyll-site') {
      git(root, '-c', 'protocol.file.allow=always', 'submodule', 'add', '--quiet', process.env.JEKYLL_TEMPLATE_SOURCE || templateRemote, 'shared/dust-wave-jekyll-template');
      git(join(root, 'shared/dust-wave-jekyll-template'), 'checkout', '--detach', templatePin);
      git(root, 'config', '-f', '.gitmodules', 'submodule.shared/dust-wave-jekyll-template.url', templateRemote);
      git(root, 'add', '.gitmodules', 'shared/dust-wave-jekyll-template');
      run(root, process.execPath, ['shared/dust-wave-jekyll-template/bin/sync-consumer.mjs', '--consumer-root', '.', '--write']);
      run(root, 'bundle', ['install']);
      run(root, 'npm', ['run', 'template:check']);
      run(root, 'npm', ['run', 'build']);
    }
    console.log(run(root, 'npm', ['test']));
    // Prove the copied pin guard rejects a drifted contract.
    const versions = JSON.parse(readFileSync(join(root, 'platform-packages.json'), 'utf8'));
    versions[Object.keys(versions)[0]] = '999.0.0';
    writeFileSync(join(root, 'platform-packages.json'), JSON.stringify(versions));
    let rejected = false;
    try { run(root, process.execPath, ['shared/dust-wave-platform/examples/recipes/check-pin.mjs']); } catch { rejected = true; }
    if (!rejected) throw new Error(`${name} accepted a drifted package version`);
    console.log(`${name}: clean checkout, offline npm install, behavior and pin-drift checks passed at ${pin}`);
  } catch (error) {
    console.error(error.stdout || '', error.stderr || '');
    throw error;
  } finally { rmSync(root, { recursive: true, force: true }); }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const helper=fileURLToPath(new URL('../bin/node-runtime.sh',import.meta.url));
test('runtime bootstrap preserves approved PATH, skips vulnerable candidates, and rejects unknown majors',()=>{
  const root=mkdtempSync(join(tmpdir(),'runtime with spaces '));
  try {
    const make=(name,version)=>{const dir=join(root,name);mkdirSync(dir);writeFileSync(join(dir,'node'),'#!/bin/bash\nprintf "%s\\n" "'+version+'"\n',{mode:0o755});return dir;};
    const bad=make('bad','v24.22.0'),good=make('good','v24.22.1'),current=make('current','v26.12.1'),unknown=make('unknown','v27.0.0');
    const run=(first,...candidates)=>spawnSync('/bin/bash',['-c',
      'source "$1"; check() { dustwave_node_meets_floor "$1" 24.22.1 26.12.1; }; shift; dustwave_prefer_node_path check "$@" && command -v node',
      'test',helper,...candidates],{env:{PATH:first+':/usr/bin:/bin'},encoding:'utf8'});
    assert.equal(run(current,bad,good).stdout.trim(),join(current,'node'));
    assert.equal(run(bad,bad,good).stdout.trim(),join(good,'node'));
    assert.notEqual(run(unknown,bad).status,0);
  } finally {rmSync(root,{recursive:true,force:true});}
});

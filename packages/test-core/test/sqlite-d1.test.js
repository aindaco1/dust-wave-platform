import assert from 'node:assert/strict';
import test from 'node:test';
import { createD1TestAdapter } from '../src/sqlite-d1.js';

let DatabaseSync;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch (error) {
  if (error.code !== 'ERR_UNKNOWN_BUILTIN_MODULE') throw error;
}

test('injected SQLite adapter preserves statements, metadata, transactions and unsupported APIs', { skip: !DatabaseSync }, async t => {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => { if (sqlite.isOpen) sqlite.close(); });
  sqlite.exec('PRAGMA foreign_keys = ON');
  const db = createD1TestAdapter(sqlite);
  assert.deepEqual(await db.exec('CREATE TABLE parent (id INTEGER PRIMARY KEY, name TEXT); CREATE TABLE child (parent_id INTEGER REFERENCES parent(id))'), { count: 0, duration: 0 });
  const insert = db.prepare('INSERT INTO parent (id, name) VALUES (?, ?)');
  const result = await insert.bind(1, 'one').run();
  assert.equal(result.meta.changes, 1);
  assert.equal(result.meta.last_row_id, 1);
  assert.equal(result.meta.changed_db, true);
  assert.deepEqual(result.results, []);
  const query = db.prepare('SELECT id, name FROM parent WHERE id = ?').bind(1);
  assert.deepEqual(await query.raw(), [[1, 'one']]);
  assert.deepEqual({ ...await query.first() }, { id: 1, name: 'one' });
  assert.equal(await query.first('name'), 'one');
  assert.equal((await query.all()).meta.rows_read, 1);
  assert.equal(await query.bind(99).first(), null);
  assert.deepEqual((await query.all()).results, []);
  await assert.rejects(db.prepare('INSERT INTO child VALUES (99)').run(), /FOREIGN KEY/);
  await assert.rejects(db.batch([insert.bind(2, 'two'), db.prepare('INSERT INTO child VALUES (99)')]), /FOREIGN KEY/);
  assert.equal(await db.prepare('SELECT COUNT(*) AS count FROM parent').first('count'), 1);
  await db.batch([insert.bind(2, 'two'), db.prepare('INSERT INTO child VALUES (2)')]);
  assert.equal(await db.prepare('SELECT COUNT(*) AS count FROM child').first('count'), 1);
  assert.deepEqual(await db.batch([]), []);
  assert.throws(() => db.withSession(), /not implemented/);
  assert.throws(() => db.dump(), /not implemented/);
  sqlite.close();
  assert.throws(() => db.prepare('SELECT 1'));
});

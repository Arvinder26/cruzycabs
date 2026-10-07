import test from 'node:test';
import assert from 'node:assert/strict';
import {sqliteDatabase} from '../lib/sqlite-adapter.ts';

test('Vercel SQLite adapter binds values and rolls back the complete failed batch',async()=>{
  const db=sqliteDatabase('file::memory:');
  await db.prepare('CREATE TABLE adapter_test(id TEXT PRIMARY KEY, value INTEGER)').run();
  await db.prepare('INSERT INTO adapter_test VALUES(?,?)').bind('original',5).run();
  assert.deepEqual(await db.prepare('SELECT * FROM adapter_test WHERE id=?').bind('original').first(),{id:'original',value:5});
  await assert.rejects(db.batch([
    db.prepare('UPDATE adapter_test SET value=99 WHERE id=?').bind('original'),
    db.prepare('INSERT INTO adapter_test VALUES(?,?)').bind('original',8),
  ]));
  assert.equal((await db.prepare('SELECT value FROM adapter_test').first()).value,5);
  const results=await db.batch([db.prepare('INSERT INTO adapter_test VALUES(?,?)').bind('second',2),db.prepare('SELECT COUNT(*) AS n FROM adapter_test')]);
  assert.equal(results[0].success,true);
  assert.equal(results[1].results[0].n,2);
});

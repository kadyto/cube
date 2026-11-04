import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../server/app.js';
import { openStore, nextSolveNumber, readSolve } from '../server/store.js';
import {
  averageOfFive,
  consecutiveWindow,
  nextAttemptNumber,
  statistics,
} from '../shared/domain.js';

test('numbered averages wait only for gaps in their five-attempt window and update after a replacement', () => {
  const solves = [1000, 1100, 1200, 1300, 1400, 1500].map((timeCs, i) => ({
    number: i + 1,
    timeCs,
    penalty: 'none',
  }));
  assert.equal(nextAttemptNumber(solves), 7);
  const missing = solves.filter((s) => s.number !== 3);
  assert.equal(nextAttemptNumber(missing), 3);
  assert.equal(statistics(missing).ao5, null);
  assert.equal(consecutiveWindow(missing).length, 0);
  const replaced = [...missing, { number: 3, timeCs: 1250, penalty: 'none' }].sort(
    (a, b) => a.number - b.number,
  );
  assert.equal(statistics(replaced).ao5, 1317);
  assert.equal(averageOfFive(consecutiveWindow(replaced, 4)), 1217);
  assert.equal(nextAttemptNumber(replaced), 7);
  assert.equal(statistics(solves.slice(1)).ao5, 1300); // A gap before the last five does not invalidate them.
  assert.equal(nextAttemptNumber([]), 1);
});

test('legacy databases preserve solve identities, values and ordering when assigned per-puzzle numbers', () => {
  const directory = mkdtempSync(join(tmpdir(), 'cube-migrate-'));
  const path = join(directory, 'cube.sqlite');
  const legacy = new DatabaseSync(path);
  legacy.exec(`CREATE TABLE solves (
    id TEXT PRIMARY KEY, event TEXT NOT NULL, time_cs INTEGER NOT NULL CHECK(time_cs > 0),
    penalty TEXT NOT NULL, scramble TEXT NOT NULL, scramble_id TEXT UNIQUE NOT NULL,
    source TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
  )`);
  const insert = legacy.prepare('INSERT INTO solves VALUES (?,?,?,?,?,?,?,?,?)');
  for (const [id, event, time] of [
    ['a', '333', 1000],
    ['b', '222', 2000],
    ['removed', '333', 3000],
    ['c', '333', 4000],
  ])
    insert.run(
      id,
      event,
      time,
      '+2',
      "R U R'",
      `scramble-${id}`,
      'manual',
      'Nota que se conserva',
      '2026-11-04T12:00:00Z',
    );
  legacy.prepare('DELETE FROM solves WHERE id=?').run('removed');
  const before = legacy
    .prepare('SELECT * FROM solves ORDER BY rowid')
    .all()
    .map((row) => ({ ...row }));
  legacy.close();
  try {
    const store = openStore(path);
    const migrated = store.db.prepare('SELECT * FROM solves ORDER BY rowid').all();
    assert.deepEqual(
      migrated.map(({ number, ...row }) => row),
      before,
    );
    assert.deepEqual(
      migrated.map((row) => [row.id, row.number]),
      [
        ['a', 1],
        ['b', 1],
        ['c', 2],
      ],
    );
    assert.equal(nextSolveNumber(store.db, '333'), 3);
    assert.equal(nextSolveNumber(store.db, '222'), 2);
    store.db.close();
    const again = openStore(path);
    assert.deepEqual(
      again.db
        .prepare('SELECT * FROM solves ORDER BY rowid')
        .all()
        .map(readSolve)
        .map((s) => [s.id, s.number]),
      [
        ['a', 1],
        ['b', 1],
        ['c', 2],
      ],
    );
    again.db.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('editing preserves identity; replacement reuses the first free puzzle number and publications use that order', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'cube-edit-'));
  const databasePath = join(directory, 'cube.sqlite');
  let app = await createApp({ databasePath, initialPassword: 'a', scrambler: () => "R U R' U'" });
  let server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  let base = `http://127.0.0.1:${server.address().port}`,
    cookie = '';
  const request = async (path, method = 'GET', body) => {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        Cookie: cookie,
        ...(method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-Cube-Request': '1' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { response, body: await response.json() };
  };
  const add = async (event, timeCs) => {
    const scramble = (await request('/scramble', 'POST', { event })).body;
    const result = await request('/solves', 'POST', {
      scrambleId: scramble.id,
      timeCs,
      penalty: 'none',
      source: 'manual',
    });
    assert.equal(result.response.status, 201);
    return result.body;
  };
  try {
    const login = await request('/login', 'POST', { password: 'a' });
    cookie = login.response.headers.get('set-cookie').split(';')[0];
    const solves = [];
    for (let i = 0; i < 6; i++) solves.push(await add('333', 1000 + i * 100));
    assert.deepEqual(
      solves.map((s) => s.number),
      [1, 2, 3, 4, 5, 6],
    );
    assert.equal((await add('222', 500)).number, 1);
    const publication = (
      await request('/publications', 'POST', { kind: 'ao5', solveId: solves[5].id })
    ).body;
    assert.equal(publication.result, 1300);
    const edited = (
      await request(`/solves/${solves[2].id}`, 'PATCH', {
        timeCs: 2000,
        penalty: '+2',
        note: 'Mi corrección',
      })
    ).body;
    assert.equal(edited.id, solves[2].id);
    assert.equal(edited.number, 3);
    assert.equal(edited.scrambleId, solves[2].scrambleId);
    assert.equal(edited.timeCs, 2000);
    assert.equal(
      (await request(`/solves/${edited.id}`, 'PATCH', { timeCs: 2100 })).body.note,
      'Mi corrección',
    );
    for (const timeCs of [0, -10, null, '1200', 1.5, 8640001])
      assert.equal(
        (await request(`/solves/${edited.id}`, 'PATCH', { timeCs })).response.status,
        400,
      );
    await request(`/solves/${edited.id}`, 'DELETE', {});
    assert.equal(
      (await request('/publications', 'POST', { kind: 'ao5', solveId: solves[5].id })).response
        .status,
      400,
    );
    assert.equal((await request('/public')).body.publications[0].result, 1300);
    const replacement = await add('333', 1250);
    assert.equal(replacement.number, 3);
    assert.notEqual(replacement.id, edited.id);
    const average = (await request('/publications', 'POST', { kind: 'ao5', solveId: solves[5].id }))
      .body;
    assert.equal(average.result, 1317);
    assert.deepEqual(
      average.solves.map((s) => s.timeCs),
      [1100, 1250, 1300, 1400, 1500],
    );
    await request(`/solves/${solves[1].id}`, 'DELETE', {});
    await request(`/solves/${solves[4].id}`, 'DELETE', {});
    assert.equal((await add('333', 1200)).number, 2);
    assert.equal((await add('333', 1400)).number, 5);
    const seventh = await add('333', 1600);
    assert.equal(seventh.number, 7);
    await request(`/solves/${seventh.id}`, 'DELETE', {});
    assert.equal((await add('333', 1700)).number, 7);
    assert.equal((await add('222', 600)).number, 2);
    await new Promise((resolve) => server.close(resolve));
    app.locals.store.db.close();
    app = await createApp({ databasePath, initialPassword: 'unused', scrambler: () => 'R U' });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await add('333', 1800)).number, 8);
    const exported = (await request('/export')).body;
    assert.deepEqual(
      exported.solves
        .filter((s) => s.event === '333')
        .map((s) => s.number)
        .sort((a, b) => a - b),
      [1, 2, 3, 4, 5, 6, 7, 8],
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    app.locals.store.db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

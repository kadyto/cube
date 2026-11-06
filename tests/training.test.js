import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { assessGoal, measurementSource, roundAverage } from '../shared/training.js';

const solve = (timeCs, number, source = 'manual', penalty = 'none') => ({
  id: `s${number}`,
  number,
  event: '333',
  timeCs,
  source,
  penalty,
  createdAt: `2026-11-06T10:00:${String(number).padStart(2, '0')}Z`,
});
const goal = (extra = {}) => ({
  event: '333',
  kind: 'single',
  targetCs: 2500,
  source: 'all',
  ...extra,
});
test('goals require strictly sub-X, include +2, ignore DNF and keep manual and web criteria distinct', () => {
  assert.equal(assessGoal(goal(), [solve(2500, 1)]).achieved, false);
  assert.equal(assessGoal(goal(), [solve(2499, 1)]).achieved, true);
  assert.equal(assessGoal(goal(), [solve(2400, 1, 'manual', '+2')]).achieved, false);
  assert.equal(assessGoal(goal(), [solve(1000, 1, 'manual', 'DNF')]).achieved, false);
  const data = [solve(2600, 1), solve(1800, 2, 'timer')];
  assert.equal(assessGoal(goal({ source: 'manual' }), data).achieved, false);
  assert.equal(assessGoal(goal({ source: 'timer' }), data).achieved, true);
  assert.equal(measurementSource(data), 'mixed');
  assert.equal(measurementSource([{ source: undefined }]), 'unknown');
});
test('ao5 goals use real consecutive attempts, never stitch together manual times around web solves or deleted holes', () => {
  const data = [
    solve(2300, 1),
    solve(2400, 2),
    solve(2200, 3, 'timer'),
    solve(2000, 4),
    solve(2100, 5),
  ];
  assert.equal(assessGoal(goal({ kind: 'ao5' }), data).best.value, 2200);
  assert.equal(assessGoal(goal({ kind: 'ao5', source: 'manual' }), data).achieved, false);
  assert.equal(
    assessGoal(
      goal({ kind: 'ao5' }),
      data.filter((item) => item.number !== 3),
    ).achieved,
    false,
  );
  assert.equal(assessGoal(goal({ kind: 'ao5' }), data.slice(0, 4)).best, null);
  const dnf = data.map((item, i) => ({ ...item, penalty: i === 0 ? 'DNF' : 'none' }));
  assert.equal(assessGoal(goal({ kind: 'ao5' }), dnf).achieved, true);
  dnf[1].penalty = 'DNF';
  assert.equal(assessGoal(goal({ kind: 'ao5' }), dnf).achieved, false);
});
test('round ao5 uses explicit slots, even when history numbers have gaps; editing or deleting evidence recalculates trophies', () => {
  const slots = [1, 3, 7, 8, 10].map((number, i) => ({
    slot: i + 1,
    solve: solve(2000 + i * 100, number),
  }));
  assert.equal(roundAverage(slots), 2200);
  const round = { event: '333', slots, cancelledAt: null };
  assert.equal(
    assessGoal(
      goal({ kind: 'ao5' }),
      slots.map((item) => item.solve),
    ).achieved,
    false,
  );
  assert.equal(
    assessGoal(
      goal({ kind: 'ao5' }),
      slots.map((item) => item.solve),
      [round],
    ).achieved,
    true,
  );
  slots[2].solve = null;
  assert.equal(roundAverage(slots), null);
  assert.equal(
    assessGoal(
      goal({ kind: 'ao5' }),
      slots.filter((item) => item.solve).map((item) => item.solve),
      [round],
    ).achieved,
    false,
  );
});

async function harness(path = ':memory:') {
  const app = await createApp({
    databasePath: path,
    initialPassword: 'a',
    scrambler: () => "R U R' U' F2",
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const request = async (path, method = 'GET', data, auth = true) => {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        Cookie: auth ? cookie : '',
        ...(method === 'GET' ? {} : { 'X-Cube-Request': '1', 'Content-Type': 'application/json' }),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return { status: response.status, body: await response.json(), response };
  };
  const logged = await request('/login', 'POST', { password: 'a' });
  cookie = logged.response.headers.get('set-cookie').split(';')[0];
  return {
    app,
    request,
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      app.locals.store.db.close();
    },
  };
}
const add = async (h, timeCs, source = 'manual', penalty = 'none') => {
  const sc = (await h.request('/scramble', 'POST', { event: '333' })).body;
  return (await h.request('/solves', 'POST', { scrambleId: sc.id, timeCs, penalty, source })).body;
};
const enter = async (h, round, index, timeCs, source = 'manual', penalty = 'none') =>
  h.request('/solves', 'POST', {
    scrambleId: round.slots[index].scramble.id,
    timeCs,
    penalty,
    source,
  });

test('goals and rounds require authentication, while the public profile exposes only explicitly shared trophies', async () => {
  const h = await harness();
  try {
    for (const path of ['/goals', '/rounds?event=333'])
      assert.equal((await h.request(path, 'GET', undefined, false)).status, 401);
    for (const [path, body] of [
      ['/goals', { event: '333' }],
      ['/rounds', { event: '333' }],
      ['/goals/fake/publish', {}],
    ])
      assert.equal((await h.request(path, 'POST', body, false)).status, 401);
    assert.deepEqual((await h.request('/public')).body.achievements, []);
    const original = (await h.request('/goals')).body.find(
      (item) => item.kind === 'single' && item.targetCs === 2500,
    );
    assert.equal((await h.request(`/goals/${original.id}/publish`, 'POST', {})).status, 400);
    const saved = await add(h, 2499);
    await h.request(`/solves/${saved.id}`, 'PATCH', { note: 'PRIVATE_GOAL_NOTE' });
    const earned = (await h.request('/goals')).body.find((item) => item.id === original.id);
    assert.equal(earned.achieved, true);
    assert.deepEqual((await h.request('/public')).body.achievements, []);
    const publication = (await h.request(`/goals/${original.id}/publish`, 'POST', {})).body;
    let visible = (await h.request('/public', 'GET', undefined, false)).body;
    assert.equal(visible.achievements[0].value, 2499);
    assert.equal(visible.achievements[0].measurementSource, 'manual');
    assert.equal(JSON.stringify(visible).includes('PRIVATE_GOAL_NOTE'), false);
    assert.equal(JSON.stringify(visible).includes(saved.id), false);
    await h.request(`/solves/${saved.id}`, 'PATCH', { penalty: 'DNF' });
    assert.equal(
      (await h.request('/goals')).body.find((item) => item.id === original.id).achieved,
      false,
    );
    assert.equal((await h.request('/public')).body.achievements[0].value, 2499);
    await h.request(`/goal-publications/${publication.id}`, 'DELETE', {});
    assert.deepEqual((await h.request('/public')).body.achievements, []);
    for (const data of [
      { event: '333', kind: 'ao5', targetCs: 2000, source: 'manual' },
      { event: 'pyram', kind: 'single', targetCs: 1000, source: 'timer' },
    ])
      assert.equal((await h.request('/goals', 'POST', data)).status, 201);
    assert.equal(
      (
        await h.request('/goals', 'POST', {
          event: '333',
          kind: 'single',
          targetCs: 0,
          source: 'all',
        })
      ).status,
      400,
    );
  } finally {
    await h.close();
  }
});

test('a five-attempt round is atomic, ordered, resumable and idempotent; deleting a slot reuses its scramble and history hole', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'cube-rounds-')),
    path = join(directory, 'cube.sqlite');
  let h = await harness(path);
  try {
    await add(h, 3100);
    const removed = await add(h, 3200);
    await add(h, 3300);
    await h.request(`/solves/${removed.id}`, 'DELETE', {});
    const starts = await Promise.all([
      h.request('/rounds', 'POST', { event: '333' }),
      h.request('/rounds', 'POST', { event: '333' }),
    ]);
    const round = starts[0].body;
    assert.equal(round.id, starts[1].body.id);
    assert.equal(round.slots.length, 5);
    assert.equal((await enter(h, round, 1, 1100)).status, 409);
    const first = await enter(h, round, 0, 1000);
    assert.equal(first.body.number, 2);
    assert.equal(first.body.roundSlot, 1);
    assert.equal((await enter(h, round, 0, 1000)).body.id, first.body.id);
    await h.close();
    h = await harness(path);
    assert.equal((await h.request(`/rounds/${round.id}`)).body.completed, 1);
    for (let i = 1; i < 5; i++)
      assert.equal(
        (await enter(h, round, i, 1000 + i * 100, i === 1 ? 'timer' : 'manual')).status,
        201,
      );
    let completed = (await h.request(`/rounds/${round.id}`)).body;
    assert.equal(completed.completed, 5);
    assert.equal(completed.average, 1200);
    assert.equal((await h.request('/public')).body.publications.length, 0);
    const published = await h.request('/publications', 'POST', {
      kind: 'ao5',
      roundId: round.id,
      title: 'Explicit round',
    });
    assert.equal(published.status, 201);
    assert.equal(published.body.result, 1200);
    assert.deepEqual(
      published.body.solves.map((item) => item.source),
      ['manual', 'timer', 'manual', 'manual', 'manual'],
    );
    const third = completed.slots[2].solve;
    await h.request(`/solves/${third.id}`, 'DELETE', {});
    assert.equal((await h.request(`/rounds/${round.id}`)).body.average, null);
    assert.equal(
      (await h.request('/publications', 'POST', { kind: 'ao5', roundId: round.id })).status,
      400,
    );
    const replacement = (await enter(h, round, 2, 2500)).body;
    assert.equal(replacement.number, third.number);
    completed = (await h.request(`/rounds/${round.id}`)).body;
    assert.equal(completed.completed, 5);
    assert.equal(completed.average, 1267);
    assert.equal((await h.request('/public')).body.publications[0].result, 1200);
    await h.request(`/solves/${completed.slots[0].solve.id}`, 'PATCH', { penalty: 'DNF' });
    await h.request(`/solves/${completed.slots[1].solve.id}`, 'PATCH', { penalty: 'DNF' });
    assert.equal((await h.request(`/rounds/${round.id}`)).body.average, 'DNF');
    const exported = (await h.request('/export')).body;
    assert.ok(exported.rounds.length);
    assert.ok(exported.goals.length);
  } finally {
    await h.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('abandoning a round keeps existing solves and prevents new slot saves; a fresh round has five new scrambles', async () => {
  const h = await harness();
  try {
    const round = (await h.request('/rounds', 'POST', { event: '222' })).body;
    await enter(h, round, 0, 800);
    await h.request(`/rounds/${round.id}/abandon`, 'POST', {});
    assert.equal((await enter(h, round, 1, 900)).status, 409);
    assert.equal((await h.request('/solves')).body.length, 1);
    const next = (await h.request('/rounds', 'POST', { event: '222' })).body;
    assert.notEqual(next.id, round.id);
    assert.equal(next.completed, 0);
    assert.ok(
      next.slots.every((slot) => !round.slots.some((old) => old.scramble.id === slot.scramble.id)),
    );
    assert.equal((await h.request('/public')).body.achievements.length, 0);
  } finally {
    await h.close();
  }
});

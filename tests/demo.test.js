import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';

async function setup(scrambler = () => "R U R' U'") {
  const app = await createApp({ databasePath: ':memory:', initialPassword: 'a', scrambler });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, data, headers = {}) => {
    const response = await fetch(`${base}/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Cube-Request': '1', ...headers },
      body: JSON.stringify(data),
    });
    return { response, body: await response.json() };
  };
  const changes = () => app.locals.store.db.prepare('SELECT total_changes() AS n').get().n;
  const close = async () => {
    await new Promise((resolve) => server.close(resolve));
    app.locals.store.db.close();
  };
  return { app, server, request, changes, close };
}

test('anonymous demo generation has no database writes, scramble IDs, cookies or access to private training', async () => {
  const { app, request, changes, close } = await setup((event) =>
    event === 'pyram' ? "R U' L B u'" : "R U R' U'",
  );
  try {
    const before = changes();
    for (const event of ['333', '222', 'pyram']) {
      const result = await request('/demo/scramble', { event });
      assert.equal(result.response.status, 200);
      assert.deepEqual(Object.keys(result.body).sort(), ['alg', 'event']);
      assert.equal(result.body.event, event);
      assert.ok(result.body.alg.length > 0);
      assert.equal(result.response.headers.get('set-cookie'), null);
      assert.equal(result.response.headers.get('cache-control'), 'no-store');
    }
    assert.equal(changes(), before);
    assert.equal(app.locals.store.db.prepare('SELECT COUNT(*) AS n FROM scrambles').get().n, 0);
    for (const path of ['/scramble', '/solves', '/publications', '/profile', '/password'])
      assert.equal(
        (await request(path, {})).response.status,
        path === '/profile' || path === '/password' ? 404 : 401,
      );
    assert.equal((await request('/demo/solves', { timeCs: 1234 })).response.status, 404);
    for (const event of ['444', '__proto__', '', null])
      assert.equal((await request('/demo/scramble', { event })).response.status, 400);
    assert.equal(changes(), before);
  } finally {
    await close();
  }
});

test('demo requests are also stateless for the owner and cannot be used as issued private scrambles', async () => {
  const { request, changes, close } = await setup();
  try {
    const cookie = (await request('/login', { password: 'a' })).response.headers
      .get('set-cookie')
      .split(';')[0];
    const before = changes();
    const demo = await request('/demo/scramble', { event: '333' }, { Cookie: cookie });
    assert.equal(demo.response.status, 200);
    assert.equal(changes(), before);
    const rejected = await request(
      '/solves',
      { timeCs: 1234, penalty: 'none', source: 'timer', scrambleId: 'demo' },
      { Cookie: cookie },
    );
    assert.equal(rejected.response.status, 400);
    assert.equal(changes(), before);
    assert.equal(
      (await request('/scramble', { event: '333' }, { Cookie: cookie })).response.status,
      200,
    );
    assert.equal(changes(), before + 1); // Private issuance retains its existing persistence.
  } finally {
    await close();
  }
});

test('a failed demo generation releases the shared queue so the next request can succeed without storing anything', async () => {
  let attempts = 0;
  const { request, changes, close } = await setup(() => {
    if (++attempts === 1) throw new Error('Test solver failure');
    return 'R U F2';
  });
  try {
    const before = changes();
    assert.equal((await request('/demo/scramble', { event: '333' })).response.status, 500);
    assert.equal((await request('/demo/scramble', { event: '222' })).response.status, 200);
    assert.equal(changes(), before);
  } finally {
    await close();
  }
});

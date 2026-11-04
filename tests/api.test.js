import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { importWca } from '../server/wca.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const fakeFetch = async (url) => {
  if (url.endsWith('/competitions'))
    return Response.json([
      {
        id: 'Madrid2025',
        name: 'Madrid 2025',
        city: 'Madrid',
        country_iso2: 'ES',
        start_date: '2025-05-04',
      },
      {
        id: 'Madrid2024',
        name: 'Madrid 2024',
        city: 'Madrid',
        country_iso2: 'ES',
        start_date: '2024-05-04',
      },
    ]);
  return Response.json({
    person: {
      wca_id: '2015BORR01',
      name: 'Nombre WCA de prueba',
      country_iso2: 'ES',
      gender: 'm',
      avatar: { url: 'https://example.com' },
    },
    personal_records: {
      333: { single: { best: 987, world_rank: 123 }, average: { best: 1234 } },
      222: { single: { best: 321 } },
      pyram: { single: { best: 500 }, average: { best: 700 } },
    },
  });
};

describe('private training and explicit public snapshots', () => {
  let app, server, base, cookie;
  const directory = mkdtempSync(join(tmpdir(), 'cube-test-'));
  const dbPath = join(directory, 'cube.sqlite');
  async function request(path, method = 'GET', data, options = {}) {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        ...(options.auth === false ? {} : { Cookie: cookie ?? '' }),
        ...(method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-Cube-Request': '1' }),
        ...options.headers,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return { status: response.status, body: await response.json(), response };
  }
  before(async () => {
    app = await createApp({
      databasePath: dbPath,
      initialPassword: 'a',
      scrambler: (event) => (event === 'pyram' ? "R U' L B u'" : "R U R' U' F2"),
      fetcher: fakeFetch,
    });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    app.locals.store.db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  test('public page does not expose training, profile, exports, or credentials', async () => {
    assert.equal(
      (await request('/public', 'GET', undefined, { auth: false })).body.publications.length,
      0,
    );
    for (const path of ['/solves', '/profile', '/publications', '/export'])
      assert.equal((await request(path, 'GET', undefined, { auth: false })).status, 401);
    for (const [path, method, body] of [
      ['/scramble', 'POST', { event: '333' }],
      ['/solves', 'POST', {}],
      ['/profile', 'PUT', {}],
      ['/password', 'PUT', {}],
      ['/publications', 'POST', {}],
      ['/publications/nope', 'DELETE', {}],
    ])
      assert.equal((await request(path, method, body, { auth: false })).status, 401);
    const publicText = JSON.stringify((await request('/public')).body);
    assert.ok(!publicText.includes('password'));
  });
  test('a one-character password works, login cookies are HttpOnly and CSRF is blocked', async () => {
    assert.equal((await request('/login', 'POST', { password: 'bad' })).status, 401);
    assert.equal(
      (await request('/login', 'POST', { password: 'a' }, { headers: { 'X-Cube-Request': '' } }))
        .status,
      403,
    );
    assert.equal(
      (
        await request(
          '/login',
          'POST',
          { password: 'a' },
          { headers: { Origin: 'https://evil.test' } },
        )
      ).status,
      403,
    );
    const login = await request('/login', 'POST', { password: 'a' });
    assert.equal(login.status, 200);
    const header = login.response.headers.get('set-cookie');
    assert.match(header, /HttpOnly/);
    assert.match(header, /SameSite=Lax/);
    cookie = header.split(';')[0];
  });
  let saved = [];
  test('times from manual and timer modes use their issued scramble, with idempotent retries', async () => {
    for (let i = 0; i < 5; i++) {
      const scramble = (await request('/scramble', 'POST', { event: '333' })).body;
      const data = {
        scrambleId: scramble.id,
        timeCs: 1000 + i * 100,
        penalty: 'none',
        source: i % 2 ? 'timer' : 'manual',
        note: 'MI NOTA SECRETA',
      };
      const result = await request('/solves', 'POST', data);
      assert.equal(result.status, 201);
      saved.push(result.body);
      assert.equal((await request('/solves', 'POST', data)).body.id, result.body.id);
    }
    assert.equal((await request('/solves')).body.length, 5);
    assert.equal((await request('/public')).body.publications.length, 0);
    assert.equal((await request('/solves', 'POST', { timeCs: 0 })).status, 400);
    assert.equal((await request('/scramble', 'POST', { event: '__proto__' })).status, 400);
    assert.equal(
      (
        await request('/solves', 'POST', {
          scrambleId: 'invented',
          timeCs: 500,
          penalty: 'none',
          source: 'manual',
        })
      ).status,
      400,
    );
  });
  let single, average;
  test('only explicitly selected single or consecutive ao5 is public; notes stay private', async () => {
    single = (
      await request('/publications', 'POST', {
        kind: 'single',
        solveId: saved[0].id,
        title: 'Mi single',
      })
    ).body;
    average = (await request('/publications', 'POST', { kind: 'ao5', solveId: saved[4].id })).body;
    assert.equal(single.result, 1000);
    assert.equal(average.result, 1200);
    assert.equal(average.solves.length, 5);
    const data = (await request('/public', 'GET', undefined, { auth: false })).body;
    assert.equal(data.publications.length, 2);
    assert.ok(!JSON.stringify(data).includes('MI NOTA SECRETA'));
    assert.equal(
      (await request('/publications', 'POST', { kind: 'ao5', solveId: saved[1].id })).status,
      400,
    );
    // A different puzzle does not enter a 3x3 ao5.
    const scramble = (await request('/scramble', 'POST', { event: '222' })).body;
    const another = (
      await request('/solves', 'POST', {
        scrambleId: scramble.id,
        timeCs: 100,
        penalty: 'none',
        source: 'manual',
      })
    ).body;
    assert.equal(
      (await request('/publications', 'POST', { kind: 'ao5', solveId: another.id })).status,
      400,
    );
  });
  test('editing and deleting a private solve do not silently change a public snapshot', async () => {
    await request(`/solves/${saved[0].id}`, 'PATCH', { penalty: 'DNF', note: 'Otra nota' });
    await request(`/solves/${saved[1].id}`, 'DELETE', {});
    const data = (await request('/public')).body;
    assert.equal(data.publications.find((p) => p.id === single.id).result, 1000);
    assert.equal(data.publications.find((p) => p.id === average.id).result, 1200);
    await request(`/publications/${single.id}`, 'DELETE', {});
    assert.equal((await request('/public')).body.publications.length, 1);
    assert.equal((await request('/solves')).body.length, 5);
  });
  test('WCA profile and competitions are opt-in, are sanitized, and can be unlinked', async () => {
    const imported = await request('/wca/import', 'POST', { wcaId: '2015borr01' });
    assert.equal(imported.status, 200);
    let profile = imported.body;
    assert.equal(profile.wca.competitions.length, 2);
    const expectedRecords = [
      { event: '333', single: 987, average: 1234 },
      { event: '222', single: 321, average: null },
      { event: 'pyram', single: 500, average: 700 },
    ];
    assert.deepEqual(profile.wca.personalRecords, expectedRecords);
    assert.equal((await request('/public')).body.profile.wca, null);
    assert.equal((await request('/profile', 'PUT', { ...profile, wcaId: '../evil' })).status, 400);
    profile = (
      await request('/profile', 'PUT', {
        ...profile,
        name: 'Mi apodo',
        showWca: true,
        showCompetitions: false,
      })
    ).body;
    let visible = (await request('/public')).body.profile;
    assert.equal(visible.name, 'Mi apodo');
    assert.equal(visible.wca.name, 'Nombre WCA de prueba');
    assert.equal(visible.wca.competitions.length, 0);
    assert.equal(visible.wca.avatar, undefined);
    assert.deepEqual(visible.wca.personalRecords, expectedRecords);
    assert.equal((await request('/public')).body.publications.length, 1);
    await request('/profile', 'PUT', { ...profile, showCompetitions: true });
    assert.equal((await request('/public')).body.profile.wca.competitions.length, 2);
    // Cached profiles from older installations remain readable and can be refreshed.
    const cachedProfile = app.locals.store.get('profile');
    delete cachedProfile.wca.personalRecords;
    app.locals.store.set('profile', cachedProfile);
    assert.equal((await request('/public')).body.profile.wca.personalRecords, null);
    await request('/wca/import', 'POST', { wcaId: profile.wcaId });
    assert.deepEqual((await request('/public')).body.profile.wca.personalRecords, expectedRecords);
    await request('/profile', 'PUT', { ...profile, wcaId: '' });
    visible = (await request('/public')).body.profile;
    assert.equal(visible.wca, null);
    assert.equal(visible.wcaId, '');
  });
  test('JSON export excludes credentials; changing password revokes other sessions', async () => {
    const exported = (await request('/export')).body;
    assert.ok(exported.solves.length);
    assert.ok(exported.publications.length);
    assert.equal(exported.password, undefined);
    assert.equal(exported.sessions, undefined);
    const other = await request('/login', 'POST', { password: 'a' });
    const otherCookie = other.response.headers.get('set-cookie').split(';')[0];
    const changed = await request('/password', 'PUT', { currentPassword: 'a', password: 'b' });
    assert.equal(changed.status, 200);
    cookie = changed.response.headers.get('set-cookie').split(';')[0];
    assert.equal(
      (await request('/solves', 'GET', undefined, { headers: { Cookie: otherCookie } })).status,
      401,
    );
    assert.equal((await request('/solves')).status, 200);
    assert.equal((await request('/login', 'POST', { password: 'a' })).status, 401);
    assert.equal((await request('/login', 'POST', { password: 'b' })).status, 200);
  });
  test('SQLite persists solves, profile, publications and changed password across restart', async () => {
    await new Promise((resolve) => server.close(resolve));
    app.locals.store.db.close();
    app = await createApp({ databasePath: dbPath, initialPassword: 'different' });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await request('/solves')).body.length, 5);
    assert.equal((await request('/public')).body.publications.length, 1);
    assert.equal((await request('/login', 'POST', { password: 'different' })).status, 401);
    assert.equal((await request('/login', 'POST', { password: 'b' })).status, 200);
    assert.equal((await request('/profile')).body.name, 'Mi apodo');
  });
  test('logout invalidates the active cookie', async () => {
    assert.equal((await request('/logout', 'POST', {})).status, 200);
    assert.equal((await request('/solves')).status, 401);
  });
});

test('WCA failures are surfaced instead of inventing profile or competitions', async () => {
  await assert.rejects(
    () => importWca('2015BORR01', async () => new Response('', { status: 404 })),
    /No encontramos/,
  );
  await assert.rejects(
    () => importWca('2015BORR01', async () => new Response('', { status: 503 })),
    /no está disponible/,
  );
  await assert.rejects(
    () => importWca('2015BORR01', async () => Response.json({})),
    /no podemos leer/,
  );
});

test('new installation requires an explicitly configured initial password', async () => {
  await assert.rejects(
    () => createApp({ databasePath: ':memory:', initialPassword: '' }),
    /INITIAL_PASSWORD/,
  );
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../server/store.js';
import { createApp } from '../server/app.js';
import { createWcaSync, WCA_REFRESH_MS, WCA_RETRY_MS } from '../server/wca-sync.js';

const ID = '2015BORR01';
const NOW = Date.parse('2026-11-04T12:00:00Z');
const logger = { warn() {} };
const cached = (importedAt) => ({
  id: ID,
  name: 'Nombre anterior',
  country: 'ES',
  importedAt,
  personalRecords: [],
  competitions: [],
});
const profile = (wca) => ({
  name: 'Mi apodo',
  bio: 'Mi presentación',
  wcaId: ID,
  wca,
  showWca: false,
  showCompetitions: false,
});
function remote() {
  const state = { calls: 0, version: 1, failure: false, gate: null };
  const fetcher = async (url) => {
    state.calls++;
    if (state.gate) await state.gate;
    if (state.failure) return new Response('', { status: 503 });
    const id = `Open${state.version}2026`;
    if (url.endsWith('/competitions'))
      return Response.json([
        {
          id,
          name: `Open ${state.version}`,
          city: 'Madrid',
          country_iso2: 'ES',
          start_date: '2026-11-01',
        },
      ]);
    if (url.endsWith('/results'))
      return Response.json([
        {
          competition_id: id,
          event_id: '333',
          round_type_id: 'f',
          pos: state.version,
          best: 1200 - state.version,
          average: 1500 - state.version,
        },
      ]);
    return Response.json({
      person: { name: `Nombre WCA ${state.version}`, country_iso2: 'ES' },
      personal_records: {
        333: { single: { best: 1200 - state.version }, average: { best: 1500 - state.version } },
      },
    });
  };
  return { state, fetcher };
}

test('hourly refresh imports new competitions and positions while preserving public preferences and the chosen name', async () => {
  const store = openStore(':memory:');
  const { state, fetcher } = remote();
  let clock = NOW;
  const initial = profile(cached(new Date(NOW - WCA_REFRESH_MS).toISOString()));
  store.set('profile', initial);
  const sync = createWcaSync(store, { fetcher, now: () => clock, logger });
  try {
    assert.equal((await sync.check()).applied, true);
    assert.equal(state.calls, 3);
    let saved = store.get('profile');
    assert.deepEqual({ ...saved, wca: initial.wca }, initial);
    assert.equal(saved.wca.competitions[0].results[0].rounds[0].position, 1);
    assert.equal(saved.wca.importedAt, new Date(NOW).toISOString());
    clock += WCA_REFRESH_MS - 1;
    state.version = 2;
    assert.equal((await sync.check()).skipped, true);
    assert.equal(state.calls, 3);
    clock++;
    await sync.check();
    saved = store.get('profile');
    assert.equal(state.calls, 6);
    assert.equal(saved.wca.competitions[0].id, 'Open22026');
    assert.equal(saved.wca.personalRecords[0].single, 1198);
    assert.equal(saved.showWca, false);
    assert.equal(saved.showCompetitions, false);
    assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM publications').get().n, 0);
  } finally {
    await sync.stop();
    store.db.close();
  }
});

test('a provider failure retains cached data and the retry delay survives a process restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'cube-wca-sync-')),
    path = join(directory, 'cube.sqlite');
  let store = openStore(path),
    clock = NOW;
  const { state, fetcher } = remote();
  state.failure = true;
  const previous = profile(cached(new Date(NOW - 2 * WCA_REFRESH_MS).toISOString()));
  store.set('profile', previous);
  let sync = createWcaSync(store, { fetcher, now: () => clock, logger });
  try {
    assert.equal((await sync.check()).failed, true);
    assert.deepEqual(store.get('profile'), previous);
    assert.ok(sync.status().error);
    assert.equal(sync.status().nextRefreshAt, new Date(NOW + WCA_RETRY_MS).toISOString());
    await sync.stop();
    store.db.close();
    store = openStore(path);
    sync = createWcaSync(store, { fetcher, now: () => clock, logger });
    state.calls = 0;
    clock += WCA_RETRY_MS - 1;
    assert.equal((await sync.check()).skipped, true);
    assert.equal(state.calls, 0);
    clock++;
    state.failure = false;
    assert.equal((await sync.check()).applied, true);
    assert.equal(state.calls, 3);
    assert.equal(sync.status().error, null);
    assert.equal(sync.status().nextRefreshAt, new Date(clock + WCA_REFRESH_MS).toISOString());
  } finally {
    await sync.stop();
    store.db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('manual and automatic refreshes share one request and preserve settings edited while fetching', async () => {
  const store = openStore(':memory:');
  store.set('profile', profile(null));
  const { state, fetcher } = remote();
  let release;
  state.gate = new Promise((resolve) => {
    release = resolve;
  });
  const sync = createWcaSync(store, { fetcher, now: () => NOW, logger });
  try {
    const background = sync.check(),
      manual = sync.refresh(ID);
    assert.equal(state.calls, 3);
    assert.equal(sync.status().refreshing, true);
    store.set('profile', {
      ...store.get('profile'),
      name: 'Apodo editado',
      bio: 'Presentación editada',
      showWca: true,
      showCompetitions: false,
    });
    release();
    await Promise.all([background, manual]);
    assert.equal(state.calls, 3);
    const saved = store.get('profile');
    assert.equal(saved.name, 'Apodo editado');
    assert.equal(saved.bio, 'Presentación editada');
    assert.equal(saved.showWca, true);
    assert.equal(saved.showCompetitions, false);
  } finally {
    await sync.stop();
    store.db.close();
  }
});

test('unlinking a profile during an in-flight refresh prevents it from being restored automatically', async () => {
  const store = openStore(':memory:');
  store.set('profile', profile(null));
  const { state, fetcher } = remote();
  let release;
  state.gate = new Promise((resolve) => {
    release = resolve;
  });
  const sync = createWcaSync(store, { fetcher, now: () => NOW, logger });
  try {
    const pending = sync.check();
    store.set('profile', { ...store.get('profile'), wcaId: '', wca: null });
    release();
    assert.equal((await pending).applied, false);
    assert.equal(sync.status().enabled, false);
    assert.equal(store.get('profile').wca, null);
    await sync.check();
    assert.equal(state.calls, 3);
  } finally {
    await sync.stop();
    store.db.close();
  }
});

test('the server scheduler checks at startup, runs while the website is closed, and stops cleanly', async () => {
  const store = openStore(':memory:');
  store.set('profile', { ...profile(null), wcaId: '' });
  const { state, fetcher } = remote();
  let tick,
    cleared = false,
    clock = NOW;
  const handle = { unref() {} };
  const sync = createWcaSync(store, {
    fetcher,
    now: () => clock,
    logger,
    setInterval(callback, delay) {
      tick = callback;
      assert.equal(delay, 60000);
      return handle;
    },
    clearInterval(timer) {
      assert.equal(timer, handle);
      cleared = true;
    },
  });
  try {
    await sync.start();
    assert.equal(state.calls, 0);
    store.set('profile', profile(null));
    await tick();
    assert.equal(state.calls, 3);
    clock += WCA_REFRESH_MS;
    state.version = 2;
    await tick();
    assert.equal(state.calls, 6);
    assert.equal(store.get('profile').wca.competitions[0].id, 'Open22026');
    await sync.stop();
    assert.equal(cleared, true);
    clock += WCA_REFRESH_MS;
    await tick();
    assert.equal(state.calls, 6);
  } finally {
    await sync.stop();
    store.db.close();
  }
});

test('legacy caches missing personal records or rounds are refreshed even when their timestamp is recent', async () => {
  const store = openStore(':memory:');
  const { state, fetcher } = remote();
  const old = cached(new Date(NOW).toISOString());
  delete old.personalRecords;
  store.set('profile', profile(old));
  const sync = createWcaSync(store, { fetcher, now: () => NOW, logger });
  try {
    await sync.check();
    assert.equal(state.calls, 3);
    assert.ok(store.get('profile').wca.personalRecords);
  } finally {
    await sync.stop();
    store.db.close();
  }
});

test('the API exposes updated WCA data only according to the existing visibility settings and keeps sync status private', async () => {
  const { state, fetcher } = remote();
  const app = await createApp({ databasePath: ':memory:', initialPassword: 'a', fetcher });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const request = async (path, method = 'GET', data, authenticated = true) => {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        Cookie: authenticated ? cookie : '',
        ...(method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-Cube-Request': '1' }),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return { response, body: await response.json() };
  };
  try {
    assert.equal((await request('/wca/status', 'GET', undefined, false)).response.status, 401);
    const login = await request('/login', 'POST', { password: 'a' });
    cookie = login.response.headers.get('set-cookie').split(';')[0];
    const imported = (await request('/wca/import', 'POST', { wcaId: ID })).body;
    assert.equal((await request('/public')).body.profile.wca, null);
    await request('/profile', 'PUT', {
      ...imported,
      name: 'Mi apodo',
      showWca: true,
      showCompetitions: true,
    });
    const saved = app.locals.store.get('profile');
    saved.wca.importedAt = '2020-01-01T00:00:00Z';
    app.locals.store.set('profile', saved);
    state.version = 2;
    await app.locals.wcaSync.start();
    const visible = (await request('/public', 'GET', undefined, false)).body;
    assert.equal(visible.profile.name, 'Mi apodo');
    assert.equal(visible.profile.wca.competitions[0].id, 'Open22026');
    assert.equal(visible.publications.length, 0);
    assert.equal(visible.wcaSync, undefined);
    assert.equal((await request('/wca/status')).body.error, null);
    await request('/profile', 'PUT', { ...app.locals.store.get('profile'), showWca: false });
    assert.equal((await request('/public')).body.profile.wca, null);
  } finally {
    await app.locals.wcaSync.stop();
    await new Promise((resolve) => server.close(resolve));
    app.locals.store.db.close();
  }
});

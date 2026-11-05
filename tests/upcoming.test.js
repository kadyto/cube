import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../server/store.js';
import { createUpcomingSync, FORECAST_INTERVAL_MS } from '../server/upcoming.js';
import { createApp } from '../server/app.js';

const ID = '2026TEST01',
  NOW = Date.parse('2026-11-05T12:00:00Z');
const profile = (extra = {}) => ({
  name: 'Mi apodo',
  bio: '',
  wcaId: ID,
  showWca: false,
  showUpcoming: false,
  calculateForecasts: true,
  ...extra,
});
const competition = {
  id: 'Future2026',
  name: 'Future Open 2026',
  city: 'Madrid',
  country_iso2: 'ES',
  start_date: '2026-11-07',
  end_date: '2026-11-08',
};
function provider() {
  const state = {
    lists: 0,
    cuts: 0,
    listFailure: false,
    cutFailure: false,
    competitions: [competition],
    gate: null,
    listGate: null,
    started: null,
  };
  const fetcher = async (url, options) => {
    assert.equal(new URL(url).hostname, 'www.worldcubeassociation.org');
    assert.equal(options.redirect, 'error');
    if (url.includes('?upcoming_competitions=true')) {
      state.lists++;
      if (state.listGate) await state.listGate;
      return state.listFailure
        ? new Response('', { status: 503 })
        : Response.json({ upcoming_competitions: state.competitions });
    }
    assert.match(url, /\/wcif\/public$/);
    state.cuts++;
    state.started?.();
    if (state.gate) await state.gate;
    if (state.cutFailure) return new Response('', { status: 503 });
    return Response.json({
      id: 'Future2026',
      formatVersion: '1.1',
      events: [{ id: '333', rounds: [{ id: '333-r1', format: 'a' }] }],
      persons: [
        {
          wcaId: ID,
          name: 'PRIVATE PERSON',
          registration: { status: 'accepted', isCompeting: true, eventIds: ['333'] },
          personalBests: [{ eventId: '333', type: 'average', best: 1500 }],
        },
      ],
    });
  };
  return { state, fetcher };
}
const logger = { warn() {} };

test('PB calculation is opt-in and one daily batch survives concurrent manual refreshes and restarts', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cube-upcoming-')),
    path = join(dir, 'cube.sqlite');
  let store = openStore(path),
    clock = NOW;
  const { state, fetcher } = provider();
  let sync = createUpcomingSync(store, { fetcher, now: () => clock, logger });
  try {
    store.set('profile', profile({ calculateForecasts: false }));
    await sync.check();
    assert.equal(state.lists, 1);
    assert.equal(state.cuts, 0);
    assert.equal(sync.snapshot({ publicView: true }), null);
    store.set('profile', profile());
    await Promise.all([sync.check({ forceListing: true }), sync.check({ forceListing: true })]);
    assert.equal(state.cuts, 1);
    assert.equal(
      sync.snapshot().forecast.nextAllowedAt,
      new Date(NOW + FORECAST_INTERVAL_MS).toISOString(),
    );
    assert.equal(sync.snapshot().competitions[0].forecast.estimates[0].positionMin, 1);
    assert.equal(JSON.stringify(store.get('wca-forecast')).includes('PRIVATE PERSON'), false);
    await sync.stop();
    store.db.close();
    store = openStore(path);
    sync = createUpcomingSync(store, { fetcher, now: () => clock, logger });
    clock += FORECAST_INTERVAL_MS - 1;
    await sync.check({ forceListing: true });
    assert.equal(state.cuts, 1);
    store.set('profile', profile({ calculateForecasts: false }));
    await sync.check();
    assert.equal(sync.snapshot().competitions[0].forecast, null);
    store.set('profile', profile({ wcaId: '2026NEXT01' }));
    await sync.check({ forceListing: true });
    assert.equal(state.cuts, 1);
    store.set('profile', profile());
    await sync.check({ forceListing: true });
    assert.equal(state.cuts, 1);
    clock++;
    await sync.check();
    assert.equal(state.cuts, 2);
  } finally {
    await sync.stop();
    store.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a failed daily comparison retains the old cut and consumes the same 24-hour limit', async () => {
  const store = openStore(':memory:');
  let clock = NOW;
  const { state, fetcher } = provider();
  const sync = createUpcomingSync(store, { fetcher, now: () => clock, logger });
  try {
    store.set('profile', profile());
    await sync.check();
    const oldDate = sync.snapshot().competitions[0].forecast.calculatedAt;
    clock += FORECAST_INTERVAL_MS;
    state.cutFailure = true;
    await sync.check();
    assert.equal(state.cuts, 2);
    assert.equal(sync.snapshot().competitions[0].forecast.calculatedAt, oldDate);
    assert.ok(sync.snapshot().forecast.error);
    clock += 1000;
    await sync.check({ forceListing: true });
    assert.equal(state.cuts, 2);
    assert.equal(
      sync.snapshot().forecast.nextAllowedAt,
      new Date(NOW + 2 * FORECAST_INTERVAL_MS).toISOString(),
    );
  } finally {
    await sync.stop();
    store.db.close();
  }
});

test('listing failures retain data, retry in 15 minutes and never trigger a cut from stale registrations', async () => {
  const store = openStore(':memory:');
  let clock = NOW;
  const { state, fetcher } = provider();
  const sync = createUpcomingSync(store, { fetcher, now: () => clock, logger });
  try {
    store.set('profile', profile({ calculateForecasts: false }));
    await sync.check();
    clock += 60 * 60000;
    state.listFailure = true;
    store.set('profile', profile());
    await sync.check();
    assert.equal(state.lists, 2);
    assert.equal(state.cuts, 0);
    assert.ok(sync.snapshot().error);
    assert.equal(sync.snapshot().competitions.length, 1);
    clock += 15 * 60000 - 1;
    await sync.check();
    assert.equal(state.lists, 2);
    clock++;
    state.listFailure = false;
    await sync.check();
    assert.equal(state.lists, 3);
    assert.equal(state.cuts, 1);
    assert.equal(sync.snapshot().error, null);
    state.competitions = [];
    await sync.check({ forceListing: true });
    assert.equal(sync.snapshot().competitions.length, 0);
  } finally {
    await sync.stop();
    store.db.close();
  }
});

test('unlinking or disabling during fetches neither restores the profile nor bypasses the daily claim', async () => {
  const store = openStore(':memory:');
  const { state, fetcher } = provider();
  const sync = createUpcomingSync(store, { fetcher, now: () => NOW, logger });
  try {
    store.set('profile', profile());
    let releaseList;
    state.listGate = new Promise((resolve) => {
      releaseList = resolve;
    });
    const first = sync.check();
    store.set('profile', profile({ wcaId: '' }));
    releaseList();
    await first;
    assert.equal(sync.snapshot().competitions.length, 0);
    assert.equal(state.cuts, 0);
    let releaseCut, began;
    const started = new Promise((resolve) => {
      began = resolve;
    });
    state.gate = new Promise((resolve) => {
      releaseCut = resolve;
    });
    state.started = began;
    store.set('profile', profile());
    const pending = sync.check();
    await started;
    assert.ok(store.get('wca-forecast').lastAttemptAt); // The durable claim precedes network completion.
    store.set('profile', profile({ name: 'Apodo nuevo', calculateForecasts: false }));
    releaseCut();
    await pending;
    assert.equal(store.get('profile').name, 'Apodo nuevo');
    assert.equal(sync.snapshot().competitions[0].forecast, null);
    store.set('profile', profile());
    await sync.check({ forceListing: true });
    assert.equal(state.cuts, 1);
  } finally {
    await sync.stop();
    store.db.close();
  }
});

test('scheduler runs without a browser and stop aborts an outstanding WCA request', async () => {
  const store = openStore(':memory:');
  const { state, fetcher } = provider();
  let tick,
    cleared = false,
    requested,
    clock = NOW;
  const begun = new Promise((resolve) => {
    requested = resolve;
  });
  const sync = createUpcomingSync(store, {
    now: () => clock,
    logger,
    fetcher: (url, options) =>
      state.lists < 1
        ? fetcher(url, options)
        : new Promise((_, reject) => {
            requested();
            options.signal.addEventListener('abort', () => reject(new Error('Aborted')), {
              once: true,
            });
          }),
    setInterval(callback, delay) {
      tick = callback;
      assert.equal(delay, 60000);
      return { unref() {} };
    },
    clearInterval() {
      cleared = true;
    },
  });
  try {
    store.set('profile', profile({ calculateForecasts: false }));
    await sync.start();
    assert.equal(state.lists, 1);
    clock += 60 * 60000;
    const pending = tick();
    await begun;
    await sync.stop();
    await pending;
    assert.equal(cleared, true);
    assert.equal(sync.snapshot().error, null);
  } finally {
    await sync.stop();
    store.db.close();
  }
});

test('API keeps upcoming events and comparison data private until the corresponding options are saved', async () => {
  const { state, fetcher } = provider();
  // Use far-future dates because the API deliberately uses the real clock.
  state.competitions = [{ ...competition, start_date: '2099-11-07', end_date: '2099-11-08' }];
  const app = await createApp({ databasePath: ':memory:', initialPassword: 'a', fetcher });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const request = async (path, method = 'GET', body, authenticated = true) => {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        Cookie: authenticated ? cookie : '',
        ...(method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-Cube-Request': '1' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { response, data: await response.json() };
  };
  try {
    for (const [path, method] of [
      ['/upcoming', 'GET'],
      ['/upcoming/refresh', 'POST'],
    ])
      assert.equal(
        (await request(path, method, method === 'POST' ? {} : undefined, false)).response.status,
        401,
      );
    cookie = (await request('/login', 'POST', { password: 'a' })).response.headers
      .get('set-cookie')
      .split(';')[0];
    const defaults = (await request('/profile')).data;
    assert.equal(defaults.showUpcoming, false);
    assert.equal(defaults.calculateForecasts, false);
    app.locals.store.set('profile', {
      ...defaults,
      wcaId: ID,
      showWca: true,
      wca: {
        id: ID,
        name: 'WCA',
        country: 'ES',
        importedAt: new Date().toISOString(),
        personalRecords: [],
        competitions: [],
      },
    });
    await request('/upcoming/refresh', 'POST', {});
    assert.equal(state.cuts, 0);
    assert.equal(
      (await request('/public', 'GET', undefined, false)).data.profile.wca.upcoming,
      null,
    );
    let saved = (await request('/profile')).data;
    saved = (await request('/profile', 'PUT', { ...saved, showUpcoming: true })).data;
    let publicData = (await request('/public', 'GET', undefined, false)).data;
    assert.equal(publicData.profile.wca.upcoming.competitions.length, 1);
    assert.equal(publicData.profile.wca.upcoming.competitions[0].forecast, null);
    saved = (await request('/profile', 'PUT', { ...saved, calculateForecasts: true })).data;
    await request('/upcoming/refresh', 'POST', {});
    publicData = (await request('/public', 'GET', undefined, false)).data;
    assert.equal(
      publicData.profile.wca.upcoming.competitions[0].forecast.estimates[0].positionMin,
      1,
    );
    assert.equal(publicData.profile.wca.upcoming.error, undefined);
    assert.equal(JSON.stringify(publicData).includes('nextAllowedAt'), false);
    await request('/upcoming/refresh', 'POST', {});
    assert.equal(state.cuts, 1);
    await request('/profile', 'PUT', { ...saved, showUpcoming: false });
    assert.equal(
      (await request('/public', 'GET', undefined, false)).data.profile.wca.upcoming,
      null,
    );
    assert.equal((await request('/upcoming')).data.competitions.length, 1);
    await request('/profile', 'PUT', { ...saved, showWca: false });
    assert.equal((await request('/public', 'GET', undefined, false)).data.profile.wca, null);
  } finally {
    await app.locals.upcomingSync.stop();
    await new Promise((resolve) => server.close(resolve));
    app.locals.store.db.close();
  }
});

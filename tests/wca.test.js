import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importWca } from '../server/wca.js';
import { formatWcaResult } from '../shared/wca.js';

test('WCA imports valid personal bests, including events outside the training puzzles', async () => {
  const imported = await importWca('2015BORR01', async (url) =>
    Response.json(
      url.endsWith('/competitions')
        ? []
        : {
            person: { name: 'Perfil de prueba', country_iso2: 'ES' },
            personal_records: {
              333: {
                single: { best: 1234, person_id: 'private-unneeded-field' },
                average: { best: 1500 },
              },
              444: { single: { best: 6245 }, average: { best: 7000 } },
              222: { single: { best: -1 }, average: { best: 0 } },
              pyram: { single: { best: '500' }, average: { best: 12.5 } },
              '333fm': { single: { best: 30 }, average: { best: 3150 } },
              unexpected: { single: { best: 111 } },
            },
          },
    ),
  );
  assert.deepEqual(imported.personalRecords, [
    { event: '333', single: 1234, average: 1500 },
    { event: '444', single: 6245, average: 7000 },
    { event: '333fm', single: 30, average: 3150 },
  ]);
});

test('WCA distinguishes no official results from a malformed records response', async () => {
  const fetcher = (records) => async (url) =>
    Response.json(
      url.endsWith('/competitions')
        ? []
        : {
            person: { name: 'Perfil de prueba' },
            personal_records: records,
          },
    );
  assert.deepEqual((await importWca('2015BORR01', fetcher({}))).personalRecords, []);
  for (const malformed of [null, [], 'invalid'])
    await assert.rejects(
      () => importWca('2015BORR01', fetcher(malformed)),
      /unas marcas que no podemos leer/,
    );
});

test('official result formatting respects centiseconds, fewest moves and multi-blind scores', () => {
  assert.equal(formatWcaResult('333', 1234), '12.34');
  assert.equal(formatWcaResult('444', 6245), '1:02.45');
  assert.equal(formatWcaResult('333fm', 30), '30 mov.');
  assert.equal(formatWcaResult('333fm', 3150, true), '31.50 mov.');
  assert.equal(formatWcaResult('333mbf', 910360002), '10/12 · 60:00');
  for (const value of [null, undefined, 0, -1, '1234'])
    assert.equal(formatWcaResult('333', value), '—');
});

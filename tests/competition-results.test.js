import { test } from 'node:test';
import assert from 'node:assert/strict';
import { competitionResults, isWcaPodium, formatWcaRoundResult } from '../shared/wca.js';

const result = (overrides = {}) => ({
  competition_id: 'Open2026',
  event_id: '333',
  round_type_id: '1',
  pos: 1,
  best: 1234,
  average: 1500,
  ...overrides,
});
test('competition results keep official positions by event and order rounds by progression, not position or response order', () => {
  const grouped = competitionResults([
    result({ round_type_id: 'f', pos: 8 }),
    result({ round_type_id: '2', pos: 12 }),
    result(),
    result({ event_id: 'pyram', pos: 3 }),
    result({ competition_id: 'Other2025', round_type_id: 'c', pos: 2 }),
  ]);
  assert.deepEqual(
    grouped.get('Open2026')[0].rounds.map((r) => [r.round, r.position]),
    [
      ['1', 1],
      ['2', 12],
      ['f', 8],
    ],
  );
  assert.equal(grouped.get('Open2026')[1].event, 'pyram');
  assert.equal(grouped.get('Other2025')[0].rounds[0].round, 'c');
});
test('round result normalization preserves DNF and DNS, rejects malformed metadata, and does not invent missing positions', () => {
  const grouped = competitionResults([
    null,
    result({ competition_id: '../bad' }),
    result({ event_id: 'unknown' }),
    result({ round_type_id: '__proto__' }),
    result({ pos: 0, best: -1, average: -2 }),
  ]);
  assert.equal(grouped.size, 1);
  assert.deepEqual(grouped.get('Open2026')[0].rounds, [
    { round: '1', position: null, best: -1, average: -2 },
  ]);
  assert.equal(formatWcaRoundResult('333', -1), 'DNF');
  assert.equal(formatWcaRoundResult('333', -2), 'DNS');
  assert.equal(formatWcaRoundResult('333', null), '—');
  assert.equal(formatWcaRoundResult('333fm', 3150, true), '31.50 mov.');
});
test('podiums require a valid top-three result in a final, never a first round or B final', () => {
  assert.equal(isWcaPodium({ round: 'f', position: 2, best: 1234 }), true);
  assert.equal(isWcaPodium({ round: 'c', position: 1, best: 1234 }), true);
  for (const round of ['1', '2', '3', 'b'])
    assert.equal(isWcaPodium({ round, position: 1, best: 1234 }), false);
  assert.equal(isWcaPodium({ round: 'f', position: 4, best: 1234 }), false);
  assert.equal(isWcaPodium({ round: 'f', position: 1, best: -1 }), false);
});

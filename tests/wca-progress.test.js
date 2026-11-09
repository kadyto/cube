import { test } from 'node:test';
import assert from 'node:assert/strict';
import { officialProgress, progressValue } from '../shared/wca-progress.js';
import { competitionResults } from '../shared/wca.js';

const round = (best, average, id = '1', format = 'a') => ({ round: id, best, average, format });
const competition = (id, date, rounds, event = '333') => ({
  id,
  name: `Open ${id}`,
  date,
  results: [{ event, rounds }],
});

test('official progress orders competitions chronologically and chooses published singles and averages independently of round rank', () => {
  const input = [
    competition('Late', '2026-10-01', [round(1100, 1400)]),
    competition('First', '2026-01-01', [round(1600, 1900)]),
    competition('Middle', '2026-06-01', [round(1500, 1700, 'f'), round(1450, 1800)]),
    competition('OtherEvent', '2026-04-01', [round(500, 700)], 'pyram'),
  ];
  const before = structuredClone(input);
  const points = officialProgress(input, '333');
  assert.deepEqual(
    points.map((point) => point.id),
    ['First', 'Middle', 'Late'],
  );
  assert.deepEqual(points[1], {
    id: 'Middle',
    name: 'Open Middle',
    date: '2026-06-01',
    single: { value: 1450, round: '1' },
    average: { value: 1700, round: 'f', format: 'a' },
  });
  assert.deepEqual(
    officialProgress(input, 'pyram').map((point) => point.id),
    ['OtherEvent'],
  );
  assert.deepEqual(officialProgress(input, '__proto__'), []);
  assert.deepEqual(input, before);
});

test('DNF, DNS and missing official marks remain gaps; valid results take precedence across rounds', () => {
  const points = officialProgress(
    [
      competition('Valid', '2026-01-01', [round(-1, -2), round(1234, 1567, 'f')]),
      competition('DNF', '2026-02-01', [round(-2, -2), round(-1, -1, 'f')]),
      competition('DNS', '2026-03-01', [round(-2, -2)]),
      competition('Missing', '2026-04-01', [round(null, 0)]),
      competition('Malformed', '2026-05-01', [round(12.34, '1234')]),
    ],
    '333',
  );
  assert.deepEqual(points[0].single, { value: 1234, round: 'f' });
  assert.deepEqual(points[0].average, { value: 1567, round: 'f', format: 'a' });
  assert.equal(points[1].single.value, -1);
  assert.equal(points[1].average.value, -1);
  assert.equal(points[2].single.value, -2);
  assert.equal(points[3].single, null);
  assert.equal(points[3].average, null);
  assert.equal(points[4].single, null);
  assert.equal(points[4].average, null);
  assert.deepEqual(
    points.map((point) => progressValue('333', point.average?.value)),
    [15.67, null, null, null, null],
  );
});

test('legacy caches keep generic media labels, formats come from WCA, and invalid dates do not invent a chronology', () => {
  const legacy = round(1000, 1400);
  delete legacy.format;
  const points = officialProgress(
    [
      competition('Legacy', '2026-01-01', [legacy]),
      competition('Mo3', '2026-02-01', [round(900, 1300, '1', 'm')]),
      competition('Undated', '', [round(800, 1200)]),
      competition('Invalid', '2026-02-31', [round(800, 1200)]),
      { id: 'Old', name: 'Pending import', date: '2026-03-01' },
    ],
    '333',
  );
  assert.equal(points.length, 2);
  assert.equal(points[0].average.format, null);
  assert.equal(points[1].average.format, 'm');
  assert.equal(
    officialProgress([competition('Only', '2026-01-01', [round(1000, 1100)])], '333').length,
    1,
  );
  const imported = competitionResults(
    ['a', 'm', '1', '2', '3', 'invalid', undefined].map((format_id, index) => ({
      competition_id: `Open${index}`,
      event_id: '333',
      round_type_id: '1',
      format_id,
      best: 1000,
      average: 1400,
    })),
  );
  for (const [index, format] of ['a', 'm', '1', '2', '3'].entries())
    assert.equal(imported.get(`Open${index}`)[0].rounds[0].format, format);
  assert.equal(Object.hasOwn(imported.get('Open5')[0].rounds[0], 'format'), false);
  assert.equal(Object.hasOwn(imported.get('Open6')[0].rounds[0], 'format'), false);
});

test('chart units preserve time and FMC semantics and never plot an encoded multi-blind score', () => {
  assert.equal(progressValue('333', 1234), 12.34);
  assert.equal(progressValue('pyram', 789), 7.89);
  assert.equal(progressValue('333fm', 30), 30);
  assert.equal(progressValue('333fm', 3150, true), 31.5);
  assert.equal(progressValue('333mbf', 910360002), null);
  for (const value of [0, -1, -2, null, undefined, '1234', Infinity, 12.5])
    assert.equal(progressValue('333', value), null);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  averageOfFive,
  effectiveTime,
  parseTime,
  formatTime,
  statistics,
} from '../shared/domain.js';

const solve = (timeCs, penalty = 'none') => ({ timeCs, penalty });
test('ao5 discards the best and worst, then rounds to a centisecond', () => {
  assert.equal(averageOfFive([1000, 1200, 1300, 1400, 3000].map((t) => solve(t))), 1300);
  assert.equal(averageOfFive([1000, 1001, 1002, 1002, 1004].map((t) => solve(t))), 1002);
  assert.equal(averageOfFive([solve(1000)]), null);
});
test('ao5 handles +2, one DNF, two DNFs and tied times', () => {
  assert.equal(
    averageOfFive([solve(1000, '+2'), solve(1100), solve(1300), solve(1400), solve(500, 'DNF')]),
    1300,
  );
  assert.equal(
    averageOfFive([solve(1000, 'DNF'), solve(1100, 'DNF'), solve(1300), solve(1400), solve(1500)]),
    'DNF',
  );
  assert.equal(averageOfFive(Array.from({ length: 5 }, () => solve(1200))), 1200);
  assert.equal(effectiveTime(solve(1234, '+2')), 1434);
});
test('manual input accepts seconds, commas and minutes and rejects malformed times', () => {
  for (const [input, expected] of [
    ['12.34', 1234],
    ['12,34', 1234],
    ['1:02.45', 6245],
    ['0.01', 1],
    ['10', 1000],
    [' 4.3 ', 430],
  ])
    assert.equal(parseTime(input), expected);
  for (const input of [
    '',
    '0',
    '-1',
    '1:60',
    '1:2:3',
    '2.345',
    'Infinity',
    '1e2',
    '24:10:00',
    '99999',
  ])
    assert.equal(parseTime(input), null, input);
  assert.equal(formatTime(6245), '1:02.45');
  assert.equal(formatTime(null), '—');
  assert.equal(formatTime('DNF'), 'DNF');
});
test('statistics keep DNF separate and compute rolling averages', () => {
  const data = [solve(900, 'DNF'), ...[1000, 1200, 1400, 1600, 1800].map((t) => solve(t))];
  assert.deepEqual(statistics(data), {
    count: 6,
    best: 1000,
    bestAo5: 1400,
    ao5: 1400,
    mean: 1400,
  });
  assert.deepEqual(statistics([]), { count: 0, best: null, bestAo5: null, ao5: null, mean: null });
});

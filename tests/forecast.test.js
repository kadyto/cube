import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateCompetition, futureCompetitions } from '../shared/forecast.js';

const ID = '2026TEST01';
const person = (wcaId, best, extra = {}) => ({
  wcaId,
  name: 'PERSONAL NAME NOT TO RETAIN',
  registration: { status: 'accepted', isCompeting: true, eventIds: ['333'] },
  personalBests: [{ eventId: '333', type: 'average', best }],
  ...extra,
});
const wcif = (persons) => ({
  formatVersion: '1.1',
  persons,
  events: [{ id: '333', rounds: [{ id: '333-r1', format: 'a' }] }],
});

test('daily PB comparison handles ties, newcomers and missing records without inventing an exact rank', () => {
  const data = wcif([
    person(ID, 1500),
    person('2020FAST01', 1000),
    person('2020SAME01', 1500),
    person('2020SLOW01', 2000),
    person(null, null, { registrantId: 5 }),
    person(null, 0, { registrantId: 6 }),
    person('2020WAIT01', 500, {
      registration: { status: 'pending', isCompeting: true, eventIds: ['333'] },
    }),
    person('2020GUES01', 500, {
      registration: { status: 'accepted', isCompeting: false, eventIds: ['333'] },
    }),
    person('2020OTHR01', 500, {
      registration: { status: 'accepted', isCompeting: true, eventIds: ['222'] },
    }),
    person('2020FAST01', 1000), // Duplicate registrations must not inflate the denominator.
  ]);
  const result = estimateCompetition(data, ID);
  assert.deepEqual(result.estimates[0], {
    event: '333',
    basis: 'average',
    ownBest: 1500,
    total: 6,
    comparable: 4,
    missing: 2,
    positionMin: 2,
    positionMax: 4,
    tied: 1,
    reason: null,
  });
  assert.equal(JSON.stringify(result).includes('PERSONAL NAME'), false);
  assert.equal(JSON.stringify(result).includes('2020FAST01'), false);
});

test('missing own PBs and unknown round formats never produce a numeric estimate', () => {
  for (const invalid of [null, -1, -2, 0, '1500', 1.5]) {
    const result = estimateCompetition(wcif([person(ID, invalid), person('2020FAST01', 1000)]), ID);
    assert.equal(result.estimates[0].ownBest, null);
    assert.equal(result.estimates[0].positionMin, null);
    assert.match(result.estimates[0].reason, /Todavía no/);
  }
  const data = wcif([person(ID, 1500)]);
  data.events[0].rounds[0].format = '?';
  assert.equal(estimateCompetition(data, ID).estimates[0].basis, null);
  assert.match(estimateCompetition(data, ID).estimates[0].reason, /Formato/);
  assert.equal(estimateCompetition(wcif([person('2020FAST01', 1000)]), ID).estimates.length, 0);
  assert.throws(() => estimateCompetition({ ...data, formatVersion: '2.0' }, ID), /formato/);
});

test('the first round determines average or single and all registered events keep WCA score ordering', () => {
  const data = {
    formatVersion: '1.1',
    events: [
      {
        id: '333',
        rounds: [
          { id: '333-r2', format: '1' },
          { id: '333-r1', format: 'm' },
        ],
      },
      { id: '333fm', rounds: [{ id: '333fm-r1', format: 'm' }] },
      { id: '333mbf', rounds: [{ id: '333mbf-r1', format: '3' }] },
    ],
    persons: [ID, '2020FAST01'].map((wcaId, i) =>
      person(wcaId, 1500, {
        registration: {
          status: 'accepted',
          isCompeting: true,
          eventIds: ['333mbf', '333fm', '333'],
        },
        personalBests: [
          { eventId: '333', type: 'single', best: i ? 2000 : 500 },
          { eventId: '333', type: 'average', value: i ? 1400 : 1500 },
          { eventId: '333fm', type: 'average', best: i ? 2500 : 2700 },
          { eventId: '333mbf', type: 'single', best: i ? 820300001 : 840300000 },
        ],
      }),
    ),
  };
  const result = estimateCompetition(data, ID);
  assert.deepEqual(result.eventIds, ['333', '333fm', '333mbf']);
  assert.deepEqual(
    result.estimates.map((row) => [row.basis, row.positionMin, row.positionMax]),
    [
      ['average', 2, 2],
      ['average', 2, 2],
      ['single', 2, 2],
    ],
  );
  for (const format of ['1', '2', '3']) {
    data.events[0].rounds.find((round) => round.id === '333-r1').format = format;
    assert.equal(estimateCompetition(data, ID).estimates[0].positionMin, 1);
  }
});

test('cached upcoming competitions disappear when their start date arrives and sort chronologically', () => {
  const values = [
    { id: 'B', date: '2026-11-08' },
    { id: 'Today', date: '2026-11-05' },
    { id: 'Past', date: '2026-11-04' },
    { id: 'A', date: '2026-11-07' },
  ];
  assert.deepEqual(
    futureCompetitions(values, Date.parse('2026-11-05T12:00Z')).map((row) => row.id),
    ['A', 'B'],
  );
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomScrambleForEvent } from 'cubing/scramble';
import { puzzles } from 'cubing/puzzles';
import { EVENTS } from '../shared/domain.js';

test(
  'real random-state scrambles are legal, nontrivial and invertible for all three puzzles',
  { timeout: 120000 },
  async () => {
    for (const [event, { puzzle }] of Object.entries(EVENTS)) {
      const kpuzzle = await puzzles[puzzle].kpuzzle();
      const alg = await randomScrambleForEvent(event);
      assert.ok(alg.toString().length > 5, event);
      const initial = kpuzzle.defaultPattern(),
        scrambled = initial.applyAlg(alg);
      assert.ok(!scrambled.isIdentical(initial), `${event} is scrambled`);
      assert.ok(
        scrambled.applyAlg(alg.invert()).isIdentical(initial),
        `${event} inverts correctly`,
      );
    }
  },
);

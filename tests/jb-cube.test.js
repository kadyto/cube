import { test } from 'node:test';
import assert from 'node:assert/strict';
import { puzzles } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';
import { JB_CUBE_FACES } from '../shared/jb-cube.js';

test('the fixed banner facelets represent a legal Jb case on yellow, with the first two layers solved', async () => {
  const puzzle = await puzzles['3x3x3'].kpuzzle();
  const solveJb = new Alg("R U R' F' R U R' U' R' F R2 U' R' U'");
  const jb = puzzle.defaultPattern().applyAlg(solveJb.invert());
  const svg = await puzzles['3x3x3'].svg();
  // Use cubing.js's sticker mapping, so the expected colors are derived from real cubies.
  const stickers = [
    ...svg.matchAll(
      /<use\s+id="(\w+)-l(\d+)-o(\d+)"[^>]*?translate\(([\d.]+),([\d.]+)\)[^>]*?fill:\s*([^";]+)[^>]*\/>/g,
    ),
  ].map((m) => ({
    id: `${m[1]}-l${m[2]}-o${m[3]}`,
    orbit: m[1],
    slot: Number(m[2]),
    orientation: Number(m[3]),
    x: Number(m[4]),
    y: Number(m[5]),
    color: m[6].trim(),
  }));
  const colors = Object.fromEntries(stickers.map((s) => [s.id, s.color]));
  const yellowUp = {
    white: 'yellow',
    yellow: 'white',
    limegreen: 'green',
    red: 'orange',
    orange: 'red',
    '#26f': 'blue',
  };
  const origins = {
    U: [3.3, 0.1],
    F: [3.3, 3.3],
    R: [6.5, 3.3],
    B: [9.7, 3.3],
    L: [0.1, 3.3],
    D: [3.3, 6.5],
  };
  for (const [face, [x, y]] of Object.entries(origins)) {
    const facelets = stickers
      .filter(
        (s) =>
          (s.orbit !== 'CENTERS' || s.orientation === 0) &&
          s.x >= x - 0.01 &&
          s.x <= x + 2.01 &&
          s.y >= y - 0.01 &&
          s.y <= y + 2.01,
      )
      .sort((a, b) => a.y - b.y || a.x - b.x);
    assert.equal(facelets.length, 9);
    const expected = facelets.map((sticker) => {
      const orbit = jb.patternData[sticker.orbit];
      const modulus = puzzle.definition.orbits.find(
        (o) => o.orbitName === sticker.orbit,
      ).numOrientations;
      const orientation =
        (sticker.orientation - orbit.orientation[sticker.slot] + modulus) % modulus;
      return yellowUp[colors[`${sticker.orbit}-l${orbit.pieces[sticker.slot]}-o${orientation}`]];
    });
    assert.deepEqual(JB_CUBE_FACES[face], expected, `${face} stickers match Jb`);
  }
  assert.ok(JB_CUBE_FACES.U.every((color) => color === 'yellow'));
  for (const face of ['F', 'R', 'B', 'L'])
    assert.ok(JB_CUBE_FACES[face].slice(3).every((color) => color === JB_CUBE_FACES[face][4]));
  assert.ok(jb.applyAlg(solveJb).isIdentical(puzzle.defaultPattern()));
});

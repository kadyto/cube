import assert from 'node:assert/strict';
import { test } from 'node:test';
import { puzzles } from 'cubing/puzzles';
import { getCasePreparation } from '../shared/case-practice.js';
import catalog from '../shared/case-practice-catalog.json' with { type: 'json' };

// Face order for each slot in the cubing.js 3×3 orbits, from sticker orientation zero onward.
// Compare abstract faces so the checks apply with yellow up and white down on any color scheme.
const CORNER_FACES = ['URF', 'UBR', 'ULB', 'UFL', 'DFR', 'DLF', 'DBL', 'DRB'];
const EDGE_FACES = ['UF', 'UR', 'UB', 'UL', 'DF', 'DR', 'DB', 'DL', 'FR', 'FL', 'BR', 'BL'];
const solved = (await puzzles['3x3x3'].kpuzzle()).defaultPattern();

function expectSolvedSlots({ pieces, orientation }, slots, message) {
  for (const slot of slots) {
    assert.equal(pieces[slot], slot, `${message}: piece in slot ${slot}`);
    assert.equal(orientation[slot], 0, `${message}: orientation in slot ${slot}`);
  }
}

function faceOfSticker({ pieces, orientation }, faces, slot, solvedFace) {
  const sticker = faces[pieces[slot]].indexOf(solvedFace);
  return faces[slot][(sticker + orientation[slot]) % faces[slot].length];
}

function expectFirstTwoLayers({ CORNERS, EDGES }, id) {
  expectSolvedSlots(CORNERS, [4, 5, 6, 7], `${id}: bottom corners`);
  expectSolvedSlots(EDGES, [4, 5, 6, 7], `${id}: cross`);
  expectSolvedSlots(EDGES, [8, 9, 10, 11], `${id}: middle edges`);
}

function preparedPattern(entry) {
  const pattern = solved.applyAlg(getCasePreparation(entry));
  const centers = pattern.patternData.CENTERS;
  assert.deepEqual(centers.pieces, solved.patternData.CENTERS.pieces, `${entry.id}: centers`);
  return pattern.patternData;
}

test('F2L preparations match all published diagrams and keep the cross and other pairs solved', () => {
  assert.equal(catalog.groups.f2l.length, 41);
  for (const entry of catalog.groups.f2l) {
    const { id, reference } = entry;
    const { CORNERS, EDGES } = preparedPattern(entry);
    expectSolvedSlots(CORNERS, [5, 6, 7], `${id}: corners outside the front-right slot`);
    expectSolvedSlots(EDGES, [9, 10, 11], `${id}: edges outside the front-right slot`);
    expectSolvedSlots(EDGES, [4, 5, 6, 7], `${id}: cross`);

    // The white/front/right corner and front/right edge belong in DFR and FR when solved.
    const corner = CORNERS.pieces.indexOf(4);
    const edge = EDGES.pieces.indexOf(8);
    assert.equal(
      [...CORNER_FACES[corner]].sort().join(''),
      [...reference.cornerPosition].sort().join(''),
      `${id}: target corner position`,
    );
    assert.equal(EDGE_FACES[edge], reference.edgePosition, `${id}: target edge position`);
    assert.equal(
      faceOfSticker(CORNERS, CORNER_FACES, corner, 'D'),
      reference.cornerFace,
      `${id}: white corner sticker`,
    );
    assert.equal(
      faceOfSticker(EDGES, EDGE_FACES, edge, 'F'),
      reference.edgeFace,
      `${id}: front-color edge sticker`,
    );
  }
});

test('OLL preparations match all published sticker codes with the first two layers solved', () => {
  assert.equal(catalog.groups.oll.length, 57);
  for (const entry of catalog.groups.oll) {
    const { id, reference } = entry;
    const pattern = preparedPattern(entry);
    expectFirstTwoLayers(pattern, id);

    // The table's top corner codes follow UFR, UBR, UBL, UFL. It calls the first
    // listed lateral face 1 and the second 2. Top edges are read in F, R, B, L order.
    assert.equal(
      pattern.CORNERS.orientation.slice(0, 4).join(''),
      reference.corners,
      `${id}: corners`,
    );
    assert.equal(pattern.EDGES.orientation.slice(0, 4).join(''), reference.edges, `${id}: edges`);
  }
});

test('PLL preparations match all published permutation codes with both layers solved and yellow up', () => {
  assert.equal(catalog.groups.pll.length, 21);
  for (const entry of catalog.groups.pll) {
    const { id, reference } = entry;
    const pattern = preparedPattern(entry);
    expectFirstTwoLayers(pattern, id);
    assert.deepEqual(pattern.CORNERS.orientation.slice(0, 4), [0, 0, 0, 0], `${id}: top corners`);
    assert.deepEqual(pattern.EDGES.orientation.slice(0, 4), [0, 0, 0, 0], `${id}: top edges`);

    // Cubing.es renumbers corners and edges together until the first corner is 1.
    const firstCorner = pattern.CORNERS.pieces[0];
    const code = ({ pieces }) =>
      pieces
        .slice(0, 4)
        .map((piece) => ((piece - firstCorner + 4) % 4) + 1)
        .join('');
    assert.equal(code(pattern.CORNERS), reference.corners, `${id}: corner permutation`);
    assert.equal(code(pattern.EDGES), reference.edges, `${id}: edge permutation`);
  }
});

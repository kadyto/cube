import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KPattern } from 'cubing/kpuzzle';
import { puzzles } from 'cubing/puzzles';
import { getCasePreparation, getPracticeCase } from '../shared/case-practice.js';
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

const cube2 = await puzzles['2x2x2'].kpuzzle();
const pyram = await puzzles.pyraminx.kpuzzle();

// Cubing.js bottom slot order is DFR, DFL, DBL, DBR. CLL leaves the layer
// solved, EG-1 swaps the back pair to put the bar in front, and EG-2 swaps
// the DFL/DBR diagonal, keeping the two corners that define the side colors.
const bottomPieces = {
  cll: [4, 5, 6, 7],
  eg1: [4, 5, 7, 6],
  eg2: [4, 7, 6, 5],
};

function cube2TablePattern(group, { pieces, orientation }) {
  return new KPattern(cube2, {
    CORNERS: {
      pieces: [...Array.from(pieces, (code) => Number(code) - 1), ...bottomPieces[group]],
      orientation: [...Array.from(orientation, Number), 0, 0, 0, 0],
    },
  });
}

// Slot numbers in the Cubing.es L4E diagram, in reading order. The pairs give
// the cubing.js edge slot and the sticker index for the table's reference face.
// They correspond to base/front, upper left/front, upper right/right, and rear/right.
const l4eSlots = [
  { slot: 2, referenceSticker: 0 },
  { slot: 0, referenceSticker: 1 },
  { slot: 5, referenceSticker: 1 },
  { slot: 1, referenceSticker: 0 },
];

function l4eTablePattern({ edges, flips }) {
  // Starting with solved data fixes the two base edges of the V and the axial pieces and tips.
  const data = structuredClone(pyram.defaultPattern().patternData);
  for (const [index, { slot, referenceSticker }] of l4eSlots.entries()) {
    const piece = l4eSlots[Number(edges[index]) - 1];
    data.EDGES.pieces[slot] = piece.slot;
    data.EDGES.orientation[slot] =
      (referenceSticker + piece.referenceSticker + Number(flips[index])) % 2;
  }
  return new KPattern(pyram, data);
}

for (const [group, count] of Object.entries({ cll: 42, eg1: 43, eg2: 43, l4e: 95 })) {
  const entries = catalog.groups[group];
  const initial = (group === 'l4e' ? pyram : cube2).defaultPattern();
  const tablePattern = (entry) =>
    group === 'l4e' ? l4eTablePattern(entry.reference) : cube2TablePattern(group, entry.reference);

  test(`${group} preparations match the published pieces and orientations`, () => {
    assert.equal(entries.length, count);
    for (const entry of entries) {
      const expected = tablePattern(entry).patternData;
      assert.notDeepEqual(expected, initial.patternData, `${entry.id}: omit the solved row`);
      assert.deepEqual(initial.applyAlg(getCasePreparation(entry)).patternData, expected, entry.id);
    }
  });

  test(`${group} published algorithms solve the patterns constructed from the table codes`, () => {
    for (const entry of entries) {
      assert.deepEqual(
        tablePattern(entry).applyAlg(entry.algorithm).patternData,
        initial.patternData,
        entry.id,
      );
    }
  });
}

const skewb = await puzzles.skewb.kpuzzle();
const solvedSkewb = skewb.defaultPattern();
// The Cubing.es diagram reads DLF, DFR, DRB, DBL. These are the slot and
// face orders of cubing.js's white-up, green-front Skewb model.
const skewbBottomSlots = [4, 2, 5, 7];
const skewbCornerFaces = ['UFL', 'UBR', 'DFR', 'URF', 'DLF', 'DRB', 'ULB', 'DBL'];
const skewbCenterFaces = 'FRDULB';
const skewbTableCenters = 'FRBLD';

function skewbTablePattern(reference) {
  const data = structuredClone(solvedSkewb.patternData);
  reference.corners.split(' ').forEach((face, index) => {
    const slot = skewbBottomSlots[index];
    data.CORNERS.orientation[slot] = skewbCornerFaces[slot].indexOf(face);
  });
  const centers = data.CENTERS.pieces;
  if (reference.centers) {
    reference.centers.split(' ').forEach((face, index) => {
      centers[skewbCenterFaces.indexOf(skewbTableCenters[index])] = skewbCenterFaces.indexOf(face);
    });
  } else if (reference.yellowCenter !== 'D') {
    // Choose an even center permutation with the yellow center in the required slot.
    // Intermediate cases do not specify the rest of the side centers.
    const yellow = skewbCenterFaces.indexOf('D');
    const target = skewbCenterFaces.indexOf(reference.yellowCenter);
    const third = skewbCenterFaces.indexOf(target === 0 ? 'R' : 'F');
    [centers[target], centers[third], centers[yellow]] = [yellow, target, third];
  }
  return new KPattern(skewb, data);
}

for (const [group, count] of [
  ['skewb-si', 11],
  ['skewb-sa', 136],
]) {
  const rows = catalog.groups[group];
  test(`${group} preparations match the published corner and center positions`, () => {
    assert.equal(rows.length, count);
    for (const [index, row] of rows.entries()) {
      const id = `${group}-${String(index + 1).padStart(group === 'skewb-si' ? 2 : 3, '0')}`;
      assert.equal(row.id, id);
      const prepared = solvedSkewb.applyAlg(getCasePreparation(getPracticeCase(id))).patternData;
      const expected = skewbTablePattern(row.reference).patternData;
      assert.deepEqual(prepared.CORNERS, expected.CORNERS, id);
      assert.equal(prepared.CENTERS.pieces[3], 3, `${id}: fixed white center`);
      assert.equal(prepared.CENTERS.pieces.indexOf(2), expected.CENTERS.pieces.indexOf(2), id);
      if (row.reference.centers)
        assert.deepEqual(prepared.CENTERS.pieces, expected.CENTERS.pieces, id);
    }
  });

  test(`${group} solutions work from the published patterns without using the inverse preparation`, () => {
    for (const row of rows) {
      const result = skewbTablePattern(row.reference).applyAlg(
        getPracticeCase(row.id).algorithm,
      ).patternData;
      assert.deepEqual(result.CORNERS, solvedSkewb.patternData.CORNERS, row.id);
      assert.equal(result.CENTERS.pieces[2], 2, `${row.id}: yellow center`);
      // Solid center stickers have no observable rotational orientation.
      if (row.reference.centers)
        assert.deepEqual(result.CENTERS.pieces, solvedSkewb.patternData.CENTERS.pieces, row.id);
    }
  });
}

test('skewb-sa-099 keeps the corrected blocks and their reference pattern', () => {
  const entry = getPracticeCase('skewb-sa-099');
  assert.deepEqual(entry.reference, { corners: 'D F D L', centers: 'R F L B D' });
  assert.deepEqual(entry.blocks, {
    preparation: 'F·S → R·S → F·H → R·S → F·H',
    solution: 'F·S → R·H → F·S → R·H → F·H',
  });
});

test('all practice URLs resolve their unique catalog entry and puzzle', () => {
  const ids = new Set();
  for (const [event, groups] of Object.entries({
    333: ['f2l', 'oll', 'pll'],
    222: ['cll', 'eg1', 'eg2'],
    pyram: ['l4e'],
    skewb: ['skewb-si', 'skewb-sa'],
  })) {
    for (const group of groups) {
      for (const entry of catalog.groups[group]) {
        assert.ok(!ids.has(entry.id), entry.id);
        ids.add(entry.id);
        const linked = getPracticeCase(entry.id);
        if ('blocks' in entry) {
          const { algorithm, preparation, ...source } = linked;
          assert.ok(algorithm && preparation);
          assert.deepEqual(source, { ...entry, event, group });
        } else {
          assert.deepEqual(linked, { ...entry, event, group });
        }
      }
    }
  }
  assert.equal(ids.size, 489);
});

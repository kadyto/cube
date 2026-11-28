import { Alg } from 'cubing/alg';
import catalog from './case-practice-catalog.json' with { type: 'json' };

export const caseGroups = catalog.groups;

/** @typedef {(typeof import('./domain.js').EVENT_IDS)[number]} CaseEvent */
/** @type {Record<CaseEvent, (keyof typeof caseGroups)[]>} */
export const caseGroupsByEvent = {
  333: ['f2l', 'oll', 'pll'],
  222: ['cll', 'eg1', 'eg2'],
  pyram: ['l4e'],
  skewb: ['skewb-si', 'skewb-sa'],
};

export const caseGroupNames = {
  f2l: 'F2L',
  oll: 'OLL',
  pll: 'PLL',
  cll: 'CLL',
  eg1: 'EG-1',
  eg2: 'EG-2',
  l4e: 'L4E',
  'skewb-si': 'Sarah intermedio',
  'skewb-sa': 'Sarah avanzado',
};

const skewbTurns = { S: "R' B R B'", H: "B R' B' R" };
// cubing.js y brings the right face to the front. Each published block restores the grip.
const skewbGrips = { F: ['', ''], R: ['y', "y'"], B: ['y2', 'y2'], L: ["y'", 'y'] };

/** @param {string} blocks */
function expandSkewbBlocks(blocks) {
  return blocks
    .split(' → ')
    .map((block) => {
      const [face, turn] = block.split('·');
      const [start, restore] = skewbGrips[face];
      return [start, skewbTurns[turn], restore].filter(Boolean).join(' ');
    })
    .join(' ');
}

const cases = /** @type {CaseEvent[]} */ (Object.keys(caseGroupsByEvent)).flatMap((event) =>
  caseGroupsByEvent[event].flatMap((group) =>
    caseGroups[group].map((entry) => {
      if ('blocks' in entry) {
        return {
          ...entry,
          algorithm: expandSkewbBlocks(entry.blocks.solution),
          preparation: expandSkewbBlocks(entry.blocks.preparation),
          event,
          group,
        };
      }
      return { ...entry, event, group };
    }),
  ),
);
const casesById = new Map(cases.map((entry) => [entry.id, entry]));

/** @param {string | null} id */
export function getPracticeCase(id) {
  return id === null ? null : (casesById.get(id) ?? null);
}

/** @param {CaseEvent} event */
export function getCaseOrientation(event) {
  if (event === 'skewb') return 'blanco arriba y verde delante';
  return event === 'pyram' ? 'amarillo abajo y verde delante' : 'amarillo arriba y verde delante';
}

/** @param {{ algorithm: string, preparation?: string }} entry */
export function getCasePreparation(entry) {
  return entry.preparation ?? Alg.fromString(entry.algorithm).invert().toString();
}

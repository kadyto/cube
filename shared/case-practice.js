import { Alg } from 'cubing/alg';
import catalog from './case-practice-catalog.json' with { type: 'json' };

export const caseGroups = catalog.groups;

/** @typedef {'333' | '222' | 'pyram'} CaseEvent */
/** @type {Record<CaseEvent, (keyof typeof caseGroups)[]>} */
export const caseGroupsByEvent = {
  333: ['f2l', 'oll', 'pll'],
  222: ['cll', 'eg1', 'eg2'],
  pyram: ['l4e'],
};

export const caseGroupNames = {
  f2l: 'F2L',
  oll: 'OLL',
  pll: 'PLL',
  cll: 'CLL',
  eg1: 'EG-1',
  eg2: 'EG-2',
  l4e: 'L4E',
};

const cases = /** @type {CaseEvent[]} */ (Object.keys(caseGroupsByEvent)).flatMap((event) =>
  caseGroupsByEvent[event].flatMap((group) =>
    caseGroups[group].map((entry) => ({ ...entry, event, group })),
  ),
);
const casesById = new Map(cases.map((entry) => [entry.id, entry]));

/** @param {string | null} id */
export function getPracticeCase(id) {
  return id === null ? null : (casesById.get(id) ?? null);
}

/** @param {CaseEvent} event */
export function getCaseOrientation(event) {
  return event === 'pyram' ? 'amarillo abajo y verde delante' : 'amarillo arriba y verde delante';
}

/** @param {{ algorithm: string }} entry */
export function getCasePreparation(entry) {
  return Alg.fromString(entry.algorithm).invert().toString();
}

import { Alg } from 'cubing/alg';
import catalog from './case-practice-catalog.json' with { type: 'json' };

export const caseGroups = catalog.groups;
const cases = Object.values(caseGroups).flat();

/** @param {string | null} id */
export function getPracticeCase(id) {
  return cases.find((entry) => entry.id === id) ?? null;
}

/** @param {{ algorithm: string }} entry */
export function getCasePreparation(entry) {
  return Alg.fromString(entry.algorithm).invert().toString();
}

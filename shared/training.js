import { averageOfFive, consecutiveWindow, effectiveTime } from './domain.js';

export const SOURCE_LABELS = {
  manual: 'A mano',
  timer: 'Cronómetro web',
  mixed: 'Mixto',
  unknown: 'Origen no registrado',
};
export function measurementSource(solves) {
  const sources = new Set(solves.map((solve) => solve.source ?? 'unknown'));
  return sources.size === 1 ? [...sources][0] : sources.has('unknown') ? 'unknown' : 'mixed';
}

/** A round uses its five explicit slots, independently of reusable history numbers. */
export function roundAverage(slots) {
  if (slots.length !== 5 || slots.some((slot) => !slot.solve)) return null;
  return averageOfFive(slots.map((slot) => slot.solve));
}

export function assessGoal(goal, allSolves, rounds = []) {
  const solves = allSolves
    .filter((solve) => solve.event === goal.event)
    .sort((a, b) => a.number - b.number);
  const eligible = (group) =>
    goal.source === 'all' || group.every((solve) => solve.source === goal.source);
  const candidates = [];
  const add = (group, value) => {
    if (group.length && eligible(group) && typeof value === 'number' && Number.isFinite(value))
      candidates.push({
        value,
        achievedAt: group
          .map((solve) => solve.createdAt)
          .sort()
          .at(-1),
        solveIds: group.map((solve) => solve.id),
        measurementSource: measurementSource(group),
      });
  };
  if (goal.kind === 'single') solves.forEach((solve) => add([solve], effectiveTime(solve)));
  else {
    for (let i = 4; i < solves.length; i++) {
      const group = consecutiveWindow(solves, i);
      if (group.length === 5) add(group, averageOfFive(group));
    }
    for (const round of rounds) {
      if (round.event !== goal.event || round.cancelledAt) continue;
      const value = roundAverage(round.slots);
      if (value !== null)
        add(
          round.slots.map((slot) => slot.solve),
          value,
        );
    }
  }
  candidates.sort((a, b) => a.value - b.value || a.achievedAt.localeCompare(b.achievedAt));
  const best = candidates[0] ?? null;
  return { ...goal, best, achieved: !!best && best.value < goal.targetCs };
}

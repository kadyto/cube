import { WCA_EVENT_IDS, WCA_ROUNDS } from './wca.js';

const validDate = (date) => {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === date;
};

/** Official best result per competition, not a running PB or a recalculated average. */
export function officialProgress(competitions, event) {
  if (!WCA_EVENT_IDS.includes(event)) return [];
  const pick = (rounds, field) => {
    const positive = rounds.filter((round) => Number.isInteger(round[field]) && round[field] > 0);
    const chosen = positive.length
      ? positive.reduce((best, round) => (round[field] < best[field] ? round : best))
      : (rounds.find((round) => round[field] === -1) ??
        rounds.find((round) => round[field] === -2));
    if (!chosen) return null;
    return {
      value: chosen[field],
      round: chosen.round,
      ...(field === 'average' ? { format: chosen.format ?? null } : {}),
    };
  };
  return competitions
    .filter((competition) => validDate(competition.date))
    .flatMap((competition) => {
      const rounds = (competition.results ?? [])
        .filter((result) => result.event === event)
        .flatMap((result) => result.rounds)
        .filter((round) => Object.hasOwn(WCA_ROUNDS, round.round))
        .sort((a, b) => WCA_ROUNDS[a.round].order - WCA_ROUNDS[b.round].order);
      if (!rounds.length) return [];
      return [
        {
          id: competition.id,
          name: competition.name,
          date: competition.date,
          single: pick(rounds, 'best'),
          average: pick(rounds, 'average'),
        },
      ];
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

/** Chart units: seconds or moves. Multi-blind's encoded score is never a duration. */
export function progressValue(event, value, average = false) {
  if (
    !WCA_EVENT_IDS.includes(event) ||
    !Number.isInteger(value) ||
    value <= 0 ||
    event === '333mbf'
  )
    return null;
  return event === '333fm' && !average ? value : value / 100;
}

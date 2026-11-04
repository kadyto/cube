import { formatTime } from './domain.js';

export const WCA_EVENTS = {
  333: '3×3×3',
  222: '2×2×2',
  444: '4×4×4',
  555: '5×5×5',
  666: '6×6×6',
  777: '7×7×7',
  '333bf': '3×3 a ciegas',
  '333fm': 'Menos movimientos',
  '333oh': '3×3 a una mano',
  clock: 'Clock',
  minx: 'Megaminx',
  pyram: 'Pyraminx',
  skewb: 'Skewb',
  sq1: 'Square-1',
  '444bf': '4×4 a ciegas',
  '555bf': '5×5 a ciegas',
  '333mbf': 'Multiciego',
  fto: 'FTO',
};

export const WCA_EVENT_IDS = [
  '333',
  '222',
  '444',
  '555',
  '666',
  '777',
  '333bf',
  '333fm',
  '333oh',
  'clock',
  'minx',
  'pyram',
  'skewb',
  'sq1',
  '444bf',
  '555bf',
  '333mbf',
  'fto',
];

export const WCA_ROUNDS = {
  0: { name: 'Clasificación', order: 0, final: false },
  h: { name: 'Clasificación con corte', order: 0, final: false },
  1: { name: 'Primera ronda', order: 1, final: false },
  d: { name: 'Primera ronda con corte', order: 1, final: false },
  2: { name: 'Segunda ronda', order: 2, final: false },
  e: { name: 'Segunda ronda con corte', order: 2, final: false },
  3: { name: 'Semifinal', order: 3, final: false },
  g: { name: 'Semifinal con corte', order: 3, final: false },
  b: { name: 'Final B', order: 4, final: false },
  f: { name: 'Final', order: 5, final: true },
  c: { name: 'Final con corte', order: 5, final: true },
};

/** Keep the published position in each round; it is not an overall competition ranking. */
export function competitionResults(rows) {
  const competitions = new Map();
  const resultValue = (value) =>
    Number.isInteger(value) && (value > 0 || value === -1 || value === -2) ? value : null;
  for (const row of rows) {
    if (
      !row ||
      !WCA_EVENT_IDS.includes(row.event_id) ||
      !Object.hasOwn(WCA_ROUNDS, row.round_type_id) ||
      typeof row.competition_id !== 'string' ||
      !/^[A-Za-z0-9_-]+$/.test(row.competition_id)
    )
      continue;
    if (!competitions.has(row.competition_id)) competitions.set(row.competition_id, new Map());
    const events = competitions.get(row.competition_id);
    if (!events.has(row.event_id)) events.set(row.event_id, []);
    events.get(row.event_id).push({
      round: String(row.round_type_id),
      position: Number.isInteger(row.pos) && row.pos > 0 ? row.pos : null,
      best: resultValue(row.best),
      average: resultValue(row.average),
    });
  }
  return new Map(
    [...competitions].map(([id, events]) => [
      id,
      WCA_EVENT_IDS.filter((event) => events.has(event)).map((event) => ({
        event,
        rounds: events
          .get(event)
          .sort((a, b) => WCA_ROUNDS[a.round].order - WCA_ROUNDS[b.round].order),
      })),
    ]),
  );
}

export function isWcaPodium(round) {
  return (
    !!WCA_ROUNDS[round.round]?.final &&
    Number.isInteger(round.position) &&
    round.position >= 1 &&
    round.position <= 3 &&
    round.best > 0
  );
}

export function formatWcaRoundResult(event, value, average = false) {
  if (value === -1) return 'DNF';
  if (value === -2) return 'DNS';
  return formatWcaResult(event, value, average);
}

/** WCA stores times in centiseconds, FMC averages in centimoves, and multi-blind as a score. */
export function formatWcaResult(event, value, average = false) {
  if (!Number.isInteger(value) || value <= 0) return '—';
  if (event === '333fm') return `${average ? (value / 100).toFixed(2) : value} mov.`;
  if (event === '333mbf') {
    const missed = value % 100;
    const solved = 99 - Math.floor(value / 10000000) + missed;
    const seconds = Math.floor(value / 100) % 100000;
    const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    return `${solved}/${solved + missed}${seconds === 99999 ? '' : ` · ${time}`}`;
  }
  return formatTime(value);
}

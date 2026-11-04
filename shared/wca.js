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

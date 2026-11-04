export const EVENTS = {
  333: { name: '3×3×3', label: 'El clásico', puzzle: '3x3x3' },
  222: { name: '2×2×2', label: 'Pequeño y veloz', puzzle: '2x2x2' },
  pyram: { name: 'Pyraminx', label: 'Un giro diferente', puzzle: 'pyraminx' },
};
export const EVENT_IDS = ['333', '222', 'pyram'];

export function nextAttemptNumber(solves) {
  const numbers = new Set(solves.map((solve) => solve.number));
  let number = 1;
  while (numbers.has(number)) number++;
  return number;
}

export function consecutiveWindow(solves, endIndex = solves.length - 1) {
  const window = solves.slice(Math.max(0, endIndex - 4), endIndex + 1);
  if (window.length !== 5) return [];
  // Unnumbered input remains supported for standalone averages and public snapshots.
  if (
    window.some((solve) => Number.isInteger(solve.number)) &&
    window.some(
      (solve, i) =>
        !Number.isInteger(solve.number) || (i > 0 && solve.number !== window[i - 1].number + 1),
    )
  )
    return [];
  return window;
}

/** Times are stored in centiseconds, as in WCA results. */
export function effectiveTime(solve) {
  return solve.penalty === 'DNF' ? Infinity : solve.timeCs + (solve.penalty === '+2' ? 200 : 0);
}

export function averageOfFive(solves) {
  if (solves.length !== 5) return null;
  const ordered = solves.map(effectiveTime).sort((a, b) => a - b);
  const middle = ordered.slice(1, 4);
  return middle.some((t) => !Number.isFinite(t))
    ? 'DNF'
    : Math.round(middle.reduce((a, b) => a + b, 0) / 3);
}

export function formatTime(cs) {
  if (cs === 'DNF' || cs === Infinity) return 'DNF';
  if (cs == null || !Number.isFinite(cs)) return '—';
  const whole = Math.floor(cs / 100),
    fraction = String(cs % 100).padStart(2, '0');
  return whole >= 60
    ? `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}.${fraction}`
    : `${whole}.${fraction}`;
}

export function parseTime(value) {
  const text = String(value).trim().replace(',', '.');
  if (!/^(?:\d{1,3}:)?\d{1,5}(?:\.\d{1,2})?$/.test(text)) return null;
  const parts = text.split(':');
  if (parts.length === 2 && Number(parts[1]) >= 60) return null;
  const cs = Math.round(
    (parts.length === 2 ? Number(parts[0]) * 60 + Number(parts[1]) : Number(parts[0])) * 100,
  );
  return cs > 0 && cs <= 8640000 ? cs : null;
}

export function statistics(solves) {
  const valid = solves.map(effectiveTime).filter(Number.isFinite);
  const averages = [];
  for (let i = 4; i < solves.length; i++)
    averages.push(averageOfFive(consecutiveWindow(solves, i)));
  const validAverages = averages.filter((v) => typeof v === 'number');
  return {
    count: solves.length,
    best: valid.length ? Math.min(...valid) : null,
    bestAo5: validAverages.length ? Math.min(...validAverages) : null,
    ao5: averageOfFive(consecutiveWindow(solves)),
    mean: valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null,
  };
}

import { normalizeWcaId, requestWca } from './wca.js';
import { estimateCompetition, futureCompetitions } from '../shared/forecast.js';

export const FORECAST_INTERVAL_MS = 24 * 60 * 60 * 1000;
const LIST_INTERVAL_MS = 60 * 60 * 1000;
const RETRY_MS = 15 * 60 * 1000;
const validDate = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00Z`));
const instant = (value) => {
  const parsed = Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : null;
};

export async function fetchUpcoming(wcaId, fetcher, signal) {
  const id = normalizeWcaId(wcaId);
  let data;
  try {
    data = await requestWca(`/users/${id}?upcoming_competitions=true`, fetcher, { signal });
  } catch (error) {
    if (error.status === 404)
      throw new Error(
        'WCA no ofrece un usuario público vinculado a este ID para consultar sus inscripciones.',
      );
    throw error;
  }
  if (!Array.isArray(data.upcoming_competitions))
    throw new Error('WCA no ha devuelto una lista pública de próximas inscripciones válida.');
  const unique = new Map();
  for (const competition of data.upcoming_competitions) {
    if (
      !competition ||
      typeof competition.id !== 'string' ||
      !/^[A-Za-z0-9_-]+$/.test(competition.id) ||
      !validDate(competition.start_date) ||
      competition.cancelled_at
    )
      continue;
    unique.set(competition.id, {
      id: competition.id,
      name: String(competition.name ?? competition.id),
      city: String(competition.city ?? competition.city_name ?? ''),
      country: String(competition.country_iso2 ?? ''),
      date: competition.start_date,
      endDate: validDate(competition.end_date) ? competition.end_date : competition.start_date,
    });
  }
  return [...unique.values()];
}

export function createUpcomingSync(store, options = {}) {
  const now = options.now ?? Date.now,
    fetcher = options.fetcher ?? fetch,
    logger = options.logger ?? console;
  let timer = null,
    stopped = false,
    listing = null,
    forecasting = null;
  const controllers = new Set();
  const currentId = () => store.get('profile', {}).wcaId ?? '';
  const iso = () => new Date(now()).toISOString();
  const allowedAt = (state) => {
    const last = instant(state.lastAttemptAt);
    return last === null ? 0 : last + FORECAST_INTERVAL_MS;
  };

  function snapshot({ publicView = false } = {}) {
    const profile = store.get('profile', {}),
      id = profile.wcaId ?? '';
    const cached = store.get('wca-upcoming', {}),
      cut = store.get('wca-forecast', {});
    const cache = cached.id === id && id ? cached : {};
    const allowEstimates = profile.calculateForecasts === true;
    const comparisons = cut.id === id && id && allowEstimates ? (cut.competitions ?? {}) : {};
    const competitions = futureCompetitions(cache.competitions ?? [], now()).map((competition) => ({
      ...competition,
      forecast: comparisons[competition.id] ?? null,
    }));
    if (publicView)
      return profile.showWca && profile.showUpcoming && id
        ? { fetchedAt: cache.fetchedAt ?? null, competitions }
        : null;
    return {
      id,
      competitions,
      fetchedAt: cache.fetchedAt ?? null,
      error: cache.error ?? null,
      refreshing: !!listing,
      forecast: {
        enabled: allowEstimates,
        refreshing: !!forecasting,
        lastAttemptAt: cut.lastAttemptAt ?? null,
        calculatedAt: cut.id === id ? (cut.calculatedAt ?? null) : null,
        nextAllowedAt: new Date(Math.max(now(), allowedAt(cut))).toISOString(),
        error: cut.id === id ? (cut.error ?? null) : null,
      },
    };
  }

  async function discover(force = false) {
    const id = currentId();
    if (!id || stopped) return;
    if (listing) return listing;
    const previous = store.get('wca-upcoming', {}),
      same = previous.id === id;
    const last = instant(
      same ? (previous.error ? previous.lastAttemptAt : previous.fetchedAt) : null,
    );
    if (!force && last !== null && now() < last + (previous.error ? RETRY_MS : LIST_INTERVAL_MS))
      return;
    const controller = new AbortController();
    controllers.add(controller);
    const task = (async () => {
      const lastAttemptAt = iso();
      try {
        const competitions = await fetchUpcoming(id, fetcher, controller.signal);
        if (stopped || currentId() !== id) return;
        store.set('wca-upcoming', {
          id,
          competitions,
          fetchedAt: iso(),
          lastAttemptAt,
          error: null,
        });
      } catch (error) {
        if (!stopped && currentId() === id)
          store.set('wca-upcoming', {
            ...(same ? previous : {}),
            id,
            lastAttemptAt,
            error: error.message,
          });
      }
    })().finally(() => {
      controllers.delete(controller);
      if (listing === task) listing = null;
    });
    listing = task;
    return task;
  }

  async function calculate() {
    if (stopped || forecasting) return forecasting;
    const profile = store.get('profile', {}),
      id = profile.wcaId;
    if (!id || profile.calculateForecasts !== true) return;
    const listingData = store.get('wca-upcoming', {});
    const competitions =
      listingData.id === id && !listingData.error
        ? futureCompetitions(listingData.competitions ?? [], now())
        : [];
    if (!competitions.length) return;
    // Claim the whole daily batch durably, before any WCIF request, including failed attempts.
    store.db.exec('BEGIN IMMEDIATE');
    let previous;
    try {
      previous = store.get('wca-forecast', {});
      if (now() < allowedAt(previous)) {
        store.db.exec('COMMIT');
        return;
      }
      store.set('wca-forecast', {
        ...(previous.id === id ? previous : {}),
        id,
        lastAttemptAt: iso(),
        error: null,
        pending: true,
      });
      store.db.exec('COMMIT');
    } catch (error) {
      store.db.exec('ROLLBACK');
      throw error;
    }
    const controller = new AbortController();
    controllers.add(controller);
    const task = (async () => {
      const results = {};
      let failed = false;
      for (const competition of competitions) {
        const latest = store.get('profile', {});
        if (stopped || latest.wcaId !== id || latest.calculateForecasts !== true) break;
        try {
          const wcif = await requestWca(`/competitions/${competition.id}/wcif/public`, fetcher, {
            signal: controller.signal,
          });
          if (wcif.id !== competition.id)
            throw new Error('La lista pública no corresponde a esta competición.');
          const active = store.get('profile', {});
          if (stopped || active.wcaId !== id || active.calculateForecasts !== true) break;
          results[competition.id] = {
            ...estimateCompetition(wcif, id),
            calculatedAt: iso(),
            error: null,
          };
        } catch {
          failed = true;
          results[competition.id] = {
            ...(previous.id === id ? (previous.competitions?.[competition.id] ?? {}) : {}),
            error:
              'No se pudo comparar la lista pública. Se podrá volver a intentar en el próximo corte diario.',
          };
        }
        const cut = store.get('wca-forecast', {});
        if (currentId() === id)
          store.set('wca-forecast', {
            ...cut,
            competitions: { ...(cut.competitions ?? {}), ...results },
          });
      }
      if (currentId() === id) {
        const cut = store.get('wca-forecast', {});
        store.set('wca-forecast', {
          ...cut,
          pending: false,
          calculatedAt: Object.values(results).some(
            (result) => result.calculatedAt && !result.error,
          )
            ? iso()
            : (cut.calculatedAt ?? null),
          error: failed
            ? 'Alguna comparación no pudo completarse. El límite de 24 horas se mantiene.'
            : null,
        });
      }
    })().finally(() => {
      controllers.delete(controller);
      if (forecasting === task) forecasting = null;
    });
    forecasting = task;
    return task;
  }

  async function check({ forceListing = false } = {}) {
    if (stopped) return snapshot();
    await discover(forceListing);
    await calculate();
    return snapshot();
  }
  const run = () =>
    check().catch((error) =>
      logger.warn(`No se pudo revisar próximas competiciones: ${error.message}`),
    );
  function start() {
    if (timer !== null) return run();
    stopped = false;
    timer = (options.setInterval ?? setInterval)(run, 60000);
    timer.unref?.();
    return run();
  }
  function kick() {
    if (timer !== null && !stopped) void run();
  }
  async function stop() {
    stopped = true;
    if (timer !== null) {
      (options.clearInterval ?? clearInterval)(timer);
      timer = null;
    }
    for (const controller of controllers) controller.abort();
    await Promise.allSettled([listing, forecasting].filter(Boolean));
  }
  return { check, snapshot, start, kick, stop };
}

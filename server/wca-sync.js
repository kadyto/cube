import { importWca, normalizeWcaId } from './wca.js';

export const WCA_REFRESH_MS = 60 * 60 * 1000;
export const WCA_RETRY_MS = 15 * 60 * 1000;
const CHECK_MS = 60 * 1000;

export function createWcaSync(store, options = {}) {
  const now = options.now ?? Date.now;
  const schedule = options.setInterval ?? setInterval;
  const unschedule = options.clearInterval ?? clearInterval;
  const logger = options.logger ?? console;
  const inFlight = new Map();
  let timer = null,
    stopped = false;
  const instant = (value) => {
    const parsed = Date.parse(value ?? '');
    return Number.isFinite(parsed) ? parsed : null;
  };

  function status() {
    const profile = store.get('profile', {});
    const id = profile.wcaId ?? '';
    const metadata = store.get('wca-sync', {});
    const active = metadata.id === id ? metadata : {};
    const cached = profile.wca?.id === id ? profile.wca : null;
    const success = instant(cached?.importedAt);
    const complete =
      cached?.personalRecords != null &&
      Array.isArray(cached?.competitions) &&
      cached.competitions.every((c) => c.results != null);
    const lastAttempt = instant(active.lastAttemptAt);
    const due =
      active.error && lastAttempt !== null
        ? lastAttempt + WCA_RETRY_MS
        : complete && success !== null
          ? success + WCA_REFRESH_MS
          : 0;
    return {
      id,
      enabled: !!id,
      intervalMinutes: WCA_REFRESH_MS / 60000,
      refreshing: inFlight.has(id),
      lastSuccessAt: success === null ? null : new Date(success).toISOString(),
      lastAttemptAt: lastAttempt === null ? null : new Date(lastAttempt).toISOString(),
      nextRefreshAt: id ? new Date(Math.max(now(), due)).toISOString() : null,
      error: active.error ?? null,
    };
  }

  function refresh(input) {
    const id = normalizeWcaId(input);
    if (stopped)
      return Promise.reject(new Error('El servidor se está reiniciando. Vuelve a intentarlo.'));
    if (inFlight.has(id)) return inFlight.get(id);
    if (store.get('profile', {}).wcaId !== id) return Promise.resolve({ applied: false });
    const task = (async () => {
      const lastAttemptAt = new Date(now()).toISOString();
      store.set('wca-sync', { id, lastAttemptAt, error: null });
      try {
        const imported = await importWca(id, options.fetcher);
        // Re-read preferences: the owner may have unlinked or edited the profile during the fetch.
        const latest = store.get('profile', {});
        if (latest.wcaId !== id) return { applied: false };
        const wca = { ...imported, importedAt: new Date(now()).toISOString() };
        store.set('profile', { ...latest, wca });
        store.set('wca-sync', { id, lastAttemptAt, error: null });
        return { applied: true };
      } catch (error) {
        if (store.get('profile', {}).wcaId === id)
          store.set('wca-sync', { id, lastAttemptAt, error: error.message });
        throw error;
      }
    })().finally(() => {
      if (inFlight.get(id) === task) inFlight.delete(id);
    });
    inFlight.set(id, task);
    return task;
  }

  async function check() {
    if (stopped) return { skipped: true };
    const current = status();
    if (!current.enabled || inFlight.has(current.id) || instant(current.nextRefreshAt) > now())
      return { skipped: true };
    try {
      return await refresh(current.id);
    } catch (error) {
      logger.warn(`No se pudo actualizar WCA: ${error.message}`);
      return { failed: true };
    }
  }

  function start() {
    if (timer !== null) return check();
    stopped = false;
    timer = schedule(
      () => check().catch((error) => logger.warn(`Error al comprobar WCA: ${error.message}`)),
      CHECK_MS,
    );
    timer.unref?.();
    return check();
  }

  async function stop() {
    stopped = true;
    if (timer !== null) {
      unschedule(timer);
      timer = null;
    }
    await Promise.allSettled([...inFlight.values()]);
  }

  return { status, refresh, check, start, stop };
}

import express from 'express';
import helmet from 'helmet';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomScrambleForEvent } from 'cubing/scramble';
import { EVENTS, averageOfFive, effectiveTime } from '../shared/domain.js';
import { openStore, readSolve, readPublication, nextSolveNumber } from './store.js';
import { hashPassword, verifyPassword, tokenHash, sessionToken, setSession } from './auth.js';
import { importWca, normalizeWcaId } from './wca.js';

const DEFAULT_PROFILE = {
  name: 'Mi rincón de cubos',
  bio: 'Una mezcla, un reto. Y muchas ganas de seguir mejorando.',
  wcaId: '',
  showWca: false,
  showCompetitions: false,
  wca: null,
};
const bad = (message, status = 400) => Object.assign(new Error(message), { status });
const text = (value, max, label) => {
  if (typeof value !== 'string' || value.length > max) throw bad(`${label} no es válido.`);
  return value.trim();
};

export async function createApp(options = {}) {
  const store = openStore(
    options.databasePath ?? process.env.DATABASE_PATH ?? resolve('data/cube.sqlite'),
  );
  const { db, get, set } = store;
  if (!get('password')) {
    const password = options.initialPassword ?? process.env.INITIAL_PASSWORD;
    if (typeof password !== 'string' || password.length === 0) {
      db.close();
      throw new Error(
        'Define INITIAL_PASSWORD para la primera puesta en marcha. Puede ser cualquier contraseña no vacía.',
      );
    }
    set('password', await hashPassword(password));
    set('profile', DEFAULT_PROFILE);
  }
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', options.trustProxy ?? (process.env.TRUST_PROXY === '1' ? 1 : false));
  const secureCookie = options.secureCookie ?? process.env.COOKIE_SECURE ?? 'auto';
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
          'font-src': ["'self'"],
          'object-src': ["'none'"],
          'frame-ancestors': ["'none'"],
          'upgrade-insecure-requests': null,
        },
      },
      strictTransportSecurity: false,
    }),
  );
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.get('X-Cube-Request') !== '1' || !req.is('application/json'))
        return next(bad('Solicitud no permitida.', 403));
      const origin = req.get('Origin');
      if (origin) {
        try {
          if (new URL(origin).host !== req.get('Host'))
            return next(bad('Origen no permitido.', 403));
        } catch {
          return next(bad('Origen no permitido.', 403));
        }
      }
    }
    next();
  });
  app.use(express.json({ limit: '64kb' }));
  const requireAuth = (req, res, next) => {
    const token = sessionToken(req);
    if (
      !token ||
      !db
        .prepare('SELECT 1 FROM sessions WHERE token=? AND expires>?')
        .get(tokenHash(token), Date.now())
    )
      return next(bad('Entra para acceder a tu entrenamiento.', 401));
    next();
  };
  const issueSession = (req, res) => {
    db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
    const token = randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions VALUES (?,?)').run(
      tokenHash(token),
      Date.now() + 7 * 86400000,
    );
    setSession(res, req, token, secureCookie);
  };
  const loginAttempts = new Map();
  app.get('/healthz', (_req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ ok: true });
  });
  app.get('/api/auth', (req, res) => {
    const token = sessionToken(req);
    res.json({
      authenticated: !!(
        token &&
        db
          .prepare('SELECT 1 FROM sessions WHERE token=? AND expires>?')
          .get(tokenHash(token), Date.now())
      ),
    });
  });
  app.post('/api/login', async (req, res) => {
    const now = Date.now(),
      key = req.ip;
    // Drop expired buckets so unauthenticated requests cannot grow this map forever.
    for (const [address, entry] of loginAttempts)
      if (entry.until < now) loginAttempts.delete(address);
    const entry = loginAttempts.get(key) ?? { count: 0, until: now + 15 * 60000 };
    if (entry.count >= 10) {
      res.set('Retry-After', String(Math.ceil((entry.until - now) / 1000)));
      throw bad('Demasiados intentos. Vuelve a probar dentro de unos minutos.', 429);
    }
    entry.count++;
    loginAttempts.set(key, entry);
    if (!(await verifyPassword(req.body.password, get('password'))))
      throw bad('La contraseña no es correcta.', 401);
    loginAttempts.delete(key);
    issueSession(req, res);
    res.json({ ok: true });
  });
  app.post('/api/logout', (req, res) => {
    const token = sessionToken(req);
    if (token) db.prepare('DELETE FROM sessions WHERE token=?').run(tokenHash(token));
    setSession(res, req, '', secureCookie, 0);
    res.json({ ok: true });
  });
  app.put('/api/password', requireAuth, async (req, res) => {
    if (!(await verifyPassword(req.body.currentPassword, get('password'))))
      throw bad('La contraseña actual no es correcta.', 401);
    if (typeof req.body.password !== 'string' || !req.body.password.length)
      throw bad('Escribe una contraseña. No hay requisitos de longitud ni complejidad.');
    set('password', await hashPassword(req.body.password));
    db.prepare('DELETE FROM sessions').run();
    issueSession(req, res);
    res.json({ ok: true });
  });
  app.get('/api/public', (_req, res) => {
    const profile = get('profile', DEFAULT_PROFILE);
    res.json({
      profile: {
        name: profile.name,
        bio: profile.bio,
        wcaId: profile.showWca ? profile.wcaId : '',
        wca:
          profile.showWca && profile.wca
            ? {
                id: profile.wca.id,
                name: profile.wca.name,
                country: profile.wca.country,
                personalRecords: profile.wca.personalRecords ?? null,
                competitions: profile.showCompetitions ? profile.wca.competitions : [],
                importedAt: profile.wca.importedAt,
              }
            : null,
      },
      publications: db
        .prepare('SELECT * FROM publications ORDER BY created_at DESC, rowid DESC')
        .all()
        .map(readPublication),
    });
  });
  app.get('/api/profile', requireAuth, (_req, res) => res.json(get('profile', DEFAULT_PROFILE)));
  app.put('/api/profile', requireAuth, (req, res) => {
    const previous = get('profile', DEFAULT_PROFILE);
    const name = text(req.body.name, 100, 'El nombre');
    if (!name) throw bad('Pon un nombre o un apodo a tu rincón.');
    let wcaId = '';
    try {
      wcaId = req.body.wcaId ? normalizeWcaId(req.body.wcaId) : '';
    } catch (error) {
      throw bad(error.message);
    }
    const profile = {
      name,
      bio: text(req.body.bio, 1000, 'La presentación'),
      wcaId,
      showWca: req.body.showWca === true,
      showCompetitions: req.body.showCompetitions === true,
      wca: previous.wca?.id === wcaId ? previous.wca : null,
    };
    set('profile', profile);
    res.json(profile);
  });
  app.post('/api/wca/import', requireAuth, async (req, res) => {
    const wca = await importWca(req.body.wcaId, options.fetcher).catch((error) => {
      throw bad(error.message, 502);
    });
    const profile = { ...get('profile', DEFAULT_PROFILE), wcaId: wca.id, wca };
    set('profile', profile);
    res.json(profile);
  });
  let scrambleQueue = Promise.resolve();
  app.post('/api/scramble', requireAuth, async (req, res) => {
    const event = req.body.event;
    if (!Object.hasOwn(EVENTS, event)) throw bad('Puzzle no válido.');
    // Serializing prevents several expensive solver initializations at once.
    const task = scrambleQueue.then(async () =>
      String(await (options.scrambler ?? randomScrambleForEvent)(event)),
    );
    scrambleQueue = task.catch(() => {});
    const alg = await task;
    const scramble = { id: randomUUID(), event, alg, createdAt: new Date().toISOString() };
    db.prepare('INSERT INTO scrambles VALUES (?,?,?,?)').run(
      scramble.id,
      event,
      alg,
      scramble.createdAt,
    );
    res.json(scramble);
  });
  app.get('/api/solves', requireAuth, (_req, res) =>
    res.json(db.prepare('SELECT * FROM solves ORDER BY rowid').all().map(readSolve)),
  );
  app.post('/api/solves', requireAuth, (req, res) => {
    const { timeCs, penalty, source, scrambleId } = req.body;
    if (!Number.isInteger(timeCs) || timeCs < 1 || timeCs > 8640000)
      throw bad('El tiempo debe estar entre 0,01 segundos y 24 horas.');
    if (!['none', '+2', 'DNF'].includes(penalty) || !['manual', 'timer'].includes(source))
      throw bad('Resultado no válido.');
    const existing = db.prepare('SELECT * FROM solves WHERE scramble_id=?').get(scrambleId ?? '');
    if (existing) return res.json(readSolve(existing)); // Safe retry after a lost network response.
    const scramble = db.prepare('SELECT * FROM scrambles WHERE id=?').get(scrambleId ?? '');
    if (!scramble) throw bad('Genera una mezcla antes de guardar el tiempo.');
    const id = randomUUID();
    const note = text(req.body.note ?? '', 500, 'La nota');
    db.exec('BEGIN IMMEDIATE');
    try {
      const number = nextSolveNumber(db, scramble.event);
      db.prepare(
        'INSERT INTO solves(id,event,time_cs,penalty,scramble,scramble_id,source,note,created_at,number) VALUES (?,?,?,?,?,?,?,?,?,?)',
      ).run(
        id,
        scramble.event,
        timeCs,
        penalty,
        scramble.alg,
        scramble.id,
        source,
        note,
        new Date().toISOString(),
        number,
      );
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    res.status(201).json(readSolve(db.prepare('SELECT * FROM solves WHERE id=?').get(id)));
  });
  app.patch('/api/solves/:id', requireAuth, (req, res) => {
    const previous = db.prepare('SELECT * FROM solves WHERE id=?').get(req.params.id);
    if (!previous) throw bad('Ese tiempo ya no existe.', 404);
    const timeCs = req.body.timeCs === undefined ? previous.time_cs : req.body.timeCs;
    const penalty = req.body.penalty === undefined ? previous.penalty : req.body.penalty;
    if (!Number.isInteger(timeCs) || timeCs < 1 || timeCs > 8640000)
      throw bad('El tiempo debe estar entre 0,01 segundos y 24 horas.');
    if (!['none', '+2', 'DNF'].includes(penalty)) throw bad('Penalización no válida.');
    db.prepare('UPDATE solves SET time_cs=?,penalty=?,note=? WHERE id=?').run(
      timeCs,
      penalty,
      req.body.note === undefined ? previous.note : text(req.body.note, 500, 'La nota'),
      req.params.id,
    );
    res.json(readSolve(db.prepare('SELECT * FROM solves WHERE id=?').get(req.params.id)));
  });
  app.delete('/api/solves/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM solves WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  });
  app.get('/api/publications', requireAuth, (_req, res) =>
    res.json(
      db
        .prepare('SELECT * FROM publications ORDER BY created_at DESC, rowid DESC')
        .all()
        .map(readPublication),
    ),
  );
  app.post('/api/publications', requireAuth, (req, res) => {
    const { kind, solveId } = req.body;
    const selected = db.prepare('SELECT * FROM solves WHERE id=?').get(solveId ?? '');
    if (!selected || !['single', 'ao5'].includes(kind))
      throw bad('Elige el tiempo que quieres publicar.');
    const rows =
      kind === 'single'
        ? [selected]
        : db
            .prepare(
              'SELECT * FROM solves WHERE event=? AND number<=? ORDER BY number DESC LIMIT 5',
            )
            .all(selected.event, selected.number)
            .reverse();
    if (rows.length !== (kind === 'single' ? 1 : 5))
      throw bad('Necesitas cinco resoluciones de este puzzle para publicar un ao5.');
    if (kind === 'ao5' && rows.some((row, i) => row.number !== selected.number - 4 + i))
      throw bad(
        'Completa los intentos pendientes de estos cinco números antes de publicar su ao5.',
      );
    // An explicit immutable snapshot. Private notes never enter the public record.
    const solves = rows.map(readSolve).map(({ timeCs, penalty, scramble, createdAt }) => ({
      timeCs,
      penalty,
      scramble,
      createdAt,
    }));
    const result =
      kind === 'single'
        ? effectiveTime(solves[0]) === Infinity
          ? 'DNF'
          : effectiveTime(solves[0])
        : averageOfFive(solves);
    const id = randomUUID();
    db.prepare('INSERT INTO publications VALUES (?,?,?,?,?,?,?)').run(
      id,
      selected.event,
      kind,
      text(req.body.title ?? '', 120, 'El título'),
      JSON.stringify(solves),
      JSON.stringify(result),
      new Date().toISOString(),
    );
    res
      .status(201)
      .json(readPublication(db.prepare('SELECT * FROM publications WHERE id=?').get(id)));
  });
  app.delete('/api/publications/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM publications WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  });
  app.get('/api/export', requireAuth, (_req, res) => {
    res.attachment('cube-historial.json').json({
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: get('profile', DEFAULT_PROFILE),
      solves: db.prepare('SELECT * FROM solves ORDER BY rowid').all().map(readSolve),
      publications: db
        .prepare('SELECT * FROM publications ORDER BY rowid')
        .all()
        .map(readPublication),
    });
  });
  app.use('/api', (_req, _res, next) => next(bad('No encontramos esa ruta.', 404)));
  const dist = resolve(options.distPath ?? 'dist');
  if (existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get('/{*path}', (_req, res) => res.sendFile(resolve(dist, 'index.html'), { maxAge: 0 }));
  }
  app.use((error, _req, res, _next) => {
    const status = error.status ?? 500;
    if (status >= 500) console.error(error.message);
    res.status(status).json({
      error:
        status === 500 ? 'No se pudo completar la operación. Inténtalo de nuevo.' : error.message,
    });
  });
  app.locals.store = store;
  return app;
}

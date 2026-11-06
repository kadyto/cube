import { randomUUID } from 'node:crypto';
import { EVENTS } from '../shared/domain.js';
import { assessGoal, roundAverage } from '../shared/training.js';
import { readSolve } from './store.js';

const bad = (message, status = 400) => Object.assign(new Error(message), { status });
const readGoal = (row) => ({
  id: row.id,
  event: row.event,
  kind: row.kind,
  targetCs: row.target_cs,
  source: row.source,
  createdAt: row.created_at,
});
export function createTraining(store, generateScramble) {
  const { db } = store,
    creating = new Map();
  const solve = (row) => {
    const context = db
      .prepare('SELECT round_id,slot FROM round_slots WHERE scramble_id=?')
      .get(row.scramble_id);
    return {
      ...readSolve(row),
      ...(context ? { roundId: context.round_id, roundSlot: context.slot } : {}),
    };
  };
  const allSolves = () =>
    db
      .prepare(
        'SELECT solves.*, rs.round_id, rs.slot FROM solves LEFT JOIN round_slots rs ON rs.scramble_id=solves.scramble_id ORDER BY solves.rowid',
      )
      .all()
      .map((row) => ({
        ...readSolve(row),
        ...(row.round_id ? { roundId: row.round_id, roundSlot: row.slot } : {}),
      }));
  function round(id) {
    const row = db.prepare('SELECT * FROM training_rounds WHERE id=?').get(id);
    if (!row) throw bad('No encontramos esa ronda.', 404);
    const slots = db
      .prepare(
        `SELECT rs.slot, sc.* FROM round_slots rs JOIN scrambles sc ON sc.id=rs.scramble_id WHERE rs.round_id=? ORDER BY rs.slot`,
      )
      .all(id)
      .map((sc) => {
        const result = db.prepare('SELECT * FROM solves WHERE scramble_id=?').get(sc.id);
        return {
          slot: sc.slot,
          scramble: {
            id: sc.id,
            event: sc.event,
            alg: sc.alg,
            createdAt: sc.created_at,
            roundId: id,
            roundSlot: sc.slot,
          },
          solve: result ? solve(result) : null,
        };
      });
    return {
      id,
      event: row.event,
      createdAt: row.created_at,
      cancelledAt: row.cancelled_at,
      slots,
      completed: slots.filter((slot) => slot.solve).length,
      average: roundAverage(slots),
    };
  }
  const rounds = (event) =>
    db
      .prepare(`SELECT id FROM training_rounds ${event ? 'WHERE event=?' : ''} ORDER BY rowid DESC`)
      .all(...(event ? [event] : []))
      .map((row) => round(row.id));
  function assertSlot(scrambleId) {
    const slot = db
      .prepare('SELECT round_id,slot FROM round_slots WHERE scramble_id=?')
      .get(scrambleId);
    if (!slot) return;
    const current = round(slot.round_id);
    if (current.cancelledAt)
      throw bad('Esta ronda está abandonada. Empieza o retoma otra ronda.', 409);
    if (current.slots.find((item) => !item.solve)?.slot !== slot.slot)
      throw bad('Guarda primero el intento pendiente de esta ronda.', 409);
  }
  async function start(event) {
    if (!Object.hasOwn(EVENTS, event)) throw bad('Puzzle no válido.');
    if (creating.has(event)) return creating.get(event);
    const incomplete = rounds(event).find((item) => !item.cancelledAt && item.completed < 5);
    if (incomplete) return incomplete;
    const task = (async () => {
      const algorithms = [];
      for (let i = 0; i < 5; i++) algorithms.push(await generateScramble(event));
      db.exec('BEGIN IMMEDIATE');
      let id;
      try {
        const existing = rounds(event).find((item) => !item.cancelledAt && item.completed < 5);
        if (existing) {
          db.exec('COMMIT');
          return existing;
        }
        id = randomUUID();
        const createdAt = new Date().toISOString();
        db.prepare('INSERT INTO training_rounds VALUES (?,?,?,NULL)').run(id, event, createdAt);
        algorithms.forEach((alg, index) => {
          const scrambleId = randomUUID();
          db.prepare('INSERT INTO scrambles VALUES (?,?,?,?)').run(
            scrambleId,
            event,
            alg,
            createdAt,
          );
          db.prepare('INSERT INTO round_slots VALUES (?,?,?)').run(id, index + 1, scrambleId);
        });
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return round(id);
    })().finally(() => creating.delete(event));
    creating.set(event, task);
    return task;
  }
  const publicGoals = () =>
    db
      .prepare('SELECT * FROM goal_publications ORDER BY created_at DESC')
      .all()
      .map((row) => ({ id: row.id, ...JSON.parse(row.snapshot), publishedAt: row.created_at }));
  const goals = () => {
    const solves = allSolves(),
      currentRounds = rounds();
    return db
      .prepare('SELECT * FROM goals ORDER BY rowid')
      .all()
      .map((row) => ({
        ...assessGoal(readGoal(row), solves, currentRounds),
        publicationId:
          db.prepare('SELECT id FROM goal_publications WHERE goal_id=?').get(row.id)?.id ?? null,
      }));
  };
  function routes(app, requireAuth) {
    app.get('/api/rounds', requireAuth, (req, res) => {
      if (!Object.hasOwn(EVENTS, req.query.event)) throw bad('Puzzle no válido.');
      const values = rounds(req.query.event);
      res.json(values.filter((item, i) => i < 20 || (!item.cancelledAt && item.completed < 5)));
    });
    app.post('/api/rounds', requireAuth, async (req, res) =>
      res.status(201).json(await start(req.body.event)),
    );
    app.get('/api/rounds/:id', requireAuth, (req, res) => res.json(round(req.params.id)));
    app.post('/api/rounds/:id/abandon', requireAuth, (req, res) => {
      round(req.params.id);
      db.prepare('UPDATE training_rounds SET cancelled_at=? WHERE id=?').run(
        new Date().toISOString(),
        req.params.id,
      );
      res.json(round(req.params.id));
    });
    app.get('/api/goals', requireAuth, (_req, res) => res.json(goals()));
    app.post('/api/goals', requireAuth, (req, res) => {
      const { event, kind, targetCs, source } = req.body;
      if (
        !Object.hasOwn(EVENTS, event) ||
        !['single', 'ao5'].includes(kind) ||
        !['all', 'manual', 'timer'].includes(source) ||
        !Number.isInteger(targetCs) ||
        targetCs < 1 ||
        targetCs > 8640000
      )
        throw bad('Elige un puzzle, una marca sub-X válida y cómo medirla.');
      const duplicate = db
        .prepare('SELECT id FROM goals WHERE event=? AND kind=? AND target_cs=? AND source=?')
        .get(event, kind, targetCs, source);
      const id = duplicate?.id ?? randomUUID();
      if (!duplicate) {
        if (db.prepare('SELECT COUNT(*) AS n FROM goals').get().n >= 100)
          throw bad('Puedes tener hasta 100 objetivos. Elimina alguno para añadir otro.');
        db.prepare('INSERT INTO goals VALUES (?,?,?,?,?,?)').run(
          id,
          event,
          kind,
          targetCs,
          source,
          new Date().toISOString(),
        );
      }
      res.status(duplicate ? 200 : 201).json(goals().find((goal) => goal.id === id));
    });
    app.delete('/api/goals/:id', requireAuth, (req, res) => {
      db.prepare('DELETE FROM goals WHERE id=?').run(req.params.id);
      res.json({ ok: true });
    });
    app.post('/api/goals/:id/publish', requireAuth, (req, res) => {
      const goal = goals().find((item) => item.id === req.params.id);
      if (!goal) throw bad('No encontramos ese objetivo.', 404);
      if (!goal.achieved || !goal.best)
        throw bad('Consigue el objetivo antes de compartir su trofeo.');
      const id = goal.publicationId ?? randomUUID();
      const snapshot = {
        event: goal.event,
        kind: goal.kind,
        targetCs: goal.targetCs,
        source: goal.source,
        value: goal.best.value,
        achievedAt: goal.best.achievedAt,
        measurementSource: goal.best.measurementSource,
      };
      if (!goal.publicationId)
        db.prepare('INSERT INTO goal_publications VALUES (?,?,?,?)').run(
          id,
          goal.id,
          JSON.stringify(snapshot),
          new Date().toISOString(),
        );
      res.status(201).json(publicGoals().find((item) => item.id === id));
    });
    app.delete('/api/goal-publications/:id', requireAuth, (req, res) => {
      db.prepare('DELETE FROM goal_publications WHERE id=?').run(req.params.id);
      res.json({ ok: true });
    });
  }
  return { solve, allSolves, round, rounds, goals, publicGoals, assertSlot, routes };
}

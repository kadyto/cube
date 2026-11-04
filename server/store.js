import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS scrambles (
      id TEXT PRIMARY KEY, event TEXT NOT NULL, alg TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS solves (
      id TEXT PRIMARY KEY, event TEXT NOT NULL, time_cs INTEGER NOT NULL CHECK(time_cs > 0),
      penalty TEXT NOT NULL CHECK(penalty IN ('none', '+2', 'DNF')),
      scramble TEXT NOT NULL, scramble_id TEXT UNIQUE NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('timer', 'manual')),
      note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS publications (
      id TEXT PRIMARY KEY, event TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('single', 'ao5')),
      title TEXT NOT NULL, solves TEXT NOT NULL, result TEXT NOT NULL, created_at TEXT NOT NULL
    );
  `);
  // Preserve the existing per-puzzle display order when upgrading older databases.
  if (
    !db
      .prepare('PRAGMA table_info(solves)')
      .all()
      .some((column) => column.name === 'number')
  ) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(`
        ALTER TABLE solves ADD COLUMN number INTEGER NOT NULL DEFAULT 1 CHECK(number > 0);
        WITH numbered AS (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY event ORDER BY rowid) AS n FROM solves
        ) UPDATE solves SET number=(SELECT n FROM numbered WHERE numbered.id=solves.id);
        CREATE UNIQUE INDEX solves_event_number ON solves(event, number);
        COMMIT;
      `);
    } catch (error) {
      db.exec('ROLLBACK');
      db.close();
      throw error;
    }
  }
  const get = (key, fallback = null) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? JSON.parse(row.value) : fallback;
  };
  const set = (key, value) =>
    db
      .prepare(
        'INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      )
      .run(key, JSON.stringify(value));
  return { db, get, set };
}

export function readSolve(row) {
  return {
    id: row.id,
    number: row.number,
    event: row.event,
    timeCs: row.time_cs,
    penalty: row.penalty,
    scramble: row.scramble,
    scrambleId: row.scramble_id,
    source: row.source,
    note: row.note,
    createdAt: row.created_at,
  };
}

export function nextSolveNumber(db, event) {
  return db
    .prepare(
      `
    SELECT MIN(candidate) AS number FROM (
      SELECT 1 AS candidate UNION ALL SELECT number+1 FROM solves WHERE event=?
    ) slots WHERE NOT EXISTS (
      SELECT 1 FROM solves WHERE event=? AND number=slots.candidate
    )
  `,
    )
    .get(event, event).number;
}

export function readPublication(row) {
  return {
    id: row.id,
    event: row.event,
    kind: row.kind,
    title: row.title,
    solves: JSON.parse(row.solves),
    result: JSON.parse(row.result),
    createdAt: row.created_at,
  };
}

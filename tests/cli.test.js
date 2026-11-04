import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../server/app.js';
import { verifyPassword } from '../server/auth.js';

const execFile = promisify(execFileCallback);
test('backup includes uncheckpointed WAL data, refuses overwrite, and password recovery revokes sessions', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'cube-cli-'));
  const path = join(directory, 'cube.sqlite'),
    destination = join(directory, 'backup.sqlite');
  const app = await createApp({ databasePath: path, initialPassword: 'a' });
  const { db, get, set } = app.locals.store;
  try {
    set('backup-marker', { message: 'Datos presentes en WAL' });
    db.prepare('INSERT INTO sessions VALUES (?,?)').run('test-session', Date.now() + 100000);
    const env = { ...process.env, DATABASE_PATH: path, CUBE_NEW_PASSWORD: 'z' };
    await execFile(process.execPath, ['server/cli.js', 'backup', destination], { env });
    const copy = new DatabaseSync(destination, { readOnly: true });
    try {
      assert.equal(
        JSON.parse(
          copy.prepare('SELECT value FROM settings WHERE key=?').get('backup-marker').value,
        ).message,
        'Datos presentes en WAL',
      );
      assert.equal(copy.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 1);
    } finally {
      copy.close();
    }
    await assert.rejects(
      () => execFile(process.execPath, ['server/cli.js', 'backup', destination], { env }),
      /La copia ya existe/,
    );
    await execFile(process.execPath, ['server/cli.js', 'reset-password'], { env });
    assert.equal(await verifyPassword('z', get('password')), true);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0);
    assert.equal(get('backup-marker').message, 'Datos presentes en WAL');
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

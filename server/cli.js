import { DatabaseSync, backup } from 'node:sqlite';
import { resolve, dirname } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import { hashPassword } from './auth.js';

const databasePath = process.env.DATABASE_PATH ?? resolve('data/cube.sqlite');
const [command, destination] = process.argv.slice(2);
if (!existsSync(databasePath))
  throw new Error('No se encuentra la base de datos. Comprueba DATABASE_PATH.');
if (!['backup', 'reset-password'].includes(command))
  throw new Error('Uso: node server/cli.js backup /ruta/copia.sqlite | reset-password');
const db = new DatabaseSync(databasePath);
try {
  if (command === 'backup') {
    if (!destination || resolve(destination) === resolve(databasePath))
      throw new Error('Elige una ruta de copia diferente a la base de datos.');
    if (existsSync(destination))
      throw new Error('La copia ya existe. Elige otro nombre para conservarla.');
    mkdirSync(dirname(resolve(destination)), { recursive: true });
    await backup(db, destination);
    console.log(
      'Copia SQLite completa creada. Incluye los datos privados y la configuración de acceso.',
    );
  } else {
    const password = process.env.CUBE_NEW_PASSWORD;
    if (!password) throw new Error('Define CUBE_NEW_PASSWORD con la nueva contraseña no vacía.');
    const hash = await hashPassword(password);
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = db
        .prepare('UPDATE settings SET value=? WHERE key=?')
        .run(JSON.stringify(hash), 'password');
      if (result.changes !== 1) throw new Error('La base de datos no está inicializada.');
      db.prepare('DELETE FROM sessions').run();
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    console.log('Contraseña restablecida. Todas las sesiones se han cerrado.');
  }
} finally {
  db.close();
}

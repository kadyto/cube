import { createApp } from './app.js';

const app = await createApp();
const server = app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0', () => {
  console.log(`Cube listo en el puerto ${server.address().port}`);
});
void app.locals.wcaSync
  .start()
  .catch((error) => console.warn(`No se pudo iniciar la actualización WCA: ${error.message}`));
void app.locals.upcomingSync.start();
let shuttingDown = false;
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    const syncStopped = Promise.all([app.locals.wcaSync.stop(), app.locals.upcomingSync.stop()]);
    server.close(async () => {
      await syncStopped;
      app.locals.store.db.close();
      process.exit(0);
    });
    server.closeIdleConnections();
  });

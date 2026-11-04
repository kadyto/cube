import { createApp } from './app.js';

const app = await createApp();
const server = app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0', () => {
  console.log(`Cube listo en el puerto ${server.address().port}`);
});
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    server.close(() => {
      app.locals.store.db.close();
      process.exit(0);
    });
    server.closeIdleConnections();
  });

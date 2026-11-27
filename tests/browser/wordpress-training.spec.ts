import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from '@playwright/test';

let server: Server;
let origin: string;
const dist = 'dist-wordpress';

test.beforeAll(async () => {
  const { assetPath, pagePath } = JSON.parse(await readFile(`${dist}/deploy.json`, 'utf8'));
  const blocks = await readFile(`${dist}/page.blocks.html`, 'utf8');
  server = createServer(async (request, response) => {
    const { pathname } = new URL(request.url ?? '/', 'http://localhost');
    if (pathname === pagePath) {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(`<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body><header><a href="/herramientas/">Herramientas</a></header>
        <main><h1 tabindex="-1">Entrenamiento</h1>${blocks}</main></body></html>`);
      return;
    }
    const file = pathname.slice(assetPath.length);
    if (pathname.startsWith(`${assetPath}/`) && /^\/assets\/[\w.-]+\.(?:css|js)$/.test(file)) {
      try {
        const contents = await readFile(`${dist}/site${file}`);
        response.writeHead(200, {
          'Content-Type': file.endsWith('.css') ? 'text/css' : 'text/javascript',
        });
        response.end(contents);
        return;
      } catch {
        // A missing module is a real failure for the browser.
      }
    }
    response.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

test('WordPress training runs locally under a nested uploads path and isolates timers and storage', async ({
  page,
  context,
}) => {
  const failed: string[] = [];
  const outside: string[] = [];
  context.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== origin || url.pathname.startsWith('/api/') || request.method() !== 'GET') {
      outside.push(request.url());
    }
  });
  page.on('pageerror', (error) => failed.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400 && response.url().includes('/assets/'))
      failed.push(response.url());
  });
  await page.goto(`${origin}/herramientas/entrenamiento/`);
  const timer = page.getByRole('button', { name: /^Cronómetro: mantén/ });
  const stage = page.locator('.cbt-stage');
  const mixture = page.getByLabel('Mezcla actual');
  const picture = page.locator('.scramble-picture');
  await expect(timer).toBeEnabled();
  await expect(mixture).toContainText(/[A-Z]/);
  await expect(picture).toHaveAttribute('data-state', 'ready');

  const pageHeading = page.getByRole('heading', { name: 'Entrenamiento', exact: true });
  await pageHeading.focus();
  const intercepted = await pageHeading.evaluate(
    (heading) =>
      !heading.dispatchEvent(
        new KeyboardEvent('keydown', {
          code: 'Space',
          bubbles: true,
          cancelable: true,
        }),
      ),
  );
  expect(intercepted).toBe(false);
  await expect(stage).toHaveAttribute('data-phase', 'idle');

  await timer.focus();
  await page.keyboard.down('Space');
  await expect(stage).toHaveAttribute('data-phase', 'ready');
  await page.keyboard.up('Space');
  await expect(stage).toHaveAttribute('data-phase', 'running');
  await page.keyboard.press('Space');
  await expect(stage).toHaveAttribute('data-phase', 'stopped');
  await expect(stage.locator('.timer-digits')).not.toHaveText('0.00');
  await page.getByRole('button', { name: 'Siguiente mezcla' }).click();
  await expect(timer).toBeEnabled();
  await expect(stage.locator('.timer-digits')).toHaveText('0.00');
  await expect(page.getByRole('button', { name: 'Nueva mezcla' })).toBeFocused();
  await page.keyboard.down('Space');
  await expect(stage).toHaveAttribute('data-phase', 'ready');
  await expect(timer).toBeFocused();
  await page.keyboard.up('Space');
  await expect(stage).toHaveAttribute('data-phase', 'running');
  await page.keyboard.press('Escape');
  await expect(stage).toHaveAttribute('data-phase', 'idle');

  for (const [event, name] of [
    ['222', '2×2'],
    ['pyram', 'Pyraminx'],
  ]) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(picture).toHaveAttribute('data-event', event);
    await expect(picture).toHaveAttribute('data-state', 'ready');
    await expect(picture.locator('svg')).toHaveCount(1);
  }
  const enlarge = page.getByRole('button', { name: 'Ampliar dibujo' });
  await enlarge.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(enlarge).toBeFocused();

  await page.setViewportSize({ width: 320, height: 780 });
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 320);
  await page.getByLabel('Inspección de 15 s').check();
  await timer.scrollIntoViewIfNeeded();
  const box = (await timer.boundingBox())!;
  const touch = await context.newCDPSession(page);
  await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  const touchPoints = [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }];
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
  await expect(stage).toHaveAttribute('data-phase', 'ready');
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(stage).toHaveAttribute('data-phase', 'inspection');
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
  await expect(stage).toHaveAttribute('data-phase', 'ready');
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(stage).toHaveAttribute('data-phase', 'running');
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(stage).toHaveAttribute('data-phase', 'stopped');

  await page.reload();
  await expect(timer).toBeEnabled();
  await expect(stage.locator('.timer-digits')).toHaveText('0.00');
  await expect(page.getByLabel('Inspección de 15 s')).not.toBeChecked();
  expect(
    await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie]),
  ).toEqual([0, 0, '']);
  expect(outside).toEqual([]);
  expect(failed).toEqual([]);
});

test('WordPress training fixes the inspection penalty before the hold and times from release', async ({
  page,
}) => {
  await page.goto(`${origin}/herramientas/entrenamiento/`);
  const timer = page.getByRole('button', { name: /^Cronómetro: mantén/ });
  const stage = page.locator('.cbt-stage');
  const inspection = page.getByLabel('Inspección de 15 s');
  await expect(timer).toBeEnabled();
  await inspection.check();
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:01:00Z'));

  for (const [duration, caption, result] of [
    [14999, 'TIEMPO DE INSPECCIÓN', '1.20'],
    [15000, 'INSPECCIÓN · +2', '3.20'],
    [16999, 'INSPECCIÓN · +2', '3.20'],
    [17000, 'INSPECCIÓN · DNF', 'DNF'],
  ] as const) {
    await page.getByRole('button', { name: 'Nueva mezcla' }).focus();
    await page.keyboard.down('Space');
    await page.clock.runFor(400);
    await expect(stage).toHaveAttribute('data-phase', 'ready');
    await page.keyboard.up('Space');
    await expect(stage).toHaveAttribute('data-phase', 'inspection');
    await page.clock.fastForward(duration);
    await page.keyboard.down('Space');
    await page.clock.runFor(400);
    await expect(timer).toContainText(caption);
    await page.keyboard.up('Space');
    await expect(stage).toHaveAttribute('data-phase', 'running');
    await page.clock.runFor(1200);
    await page.keyboard.press('Space');
    await expect(stage.locator('.timer-digits')).toHaveText(result);
    await page.getByRole('button', { name: 'Siguiente mezcla' }).click();
    await expect(timer).toBeEnabled();
  }
});

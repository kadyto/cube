import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from '@playwright/test';
import { getCasePreparation, getPracticeCase } from '../../shared/case-practice.js';

const pagePath = '/herramientas/entrenamiento/';
const media = 'dist-wordpress/media';
const frameSelector = '#cubing-entrenamiento-marco';
let server: Server;
let origin: string;
let mediaPath: string;

test.beforeAll(async () => {
  const block = (await readFile(`${media}/page-media.blocks.html`, 'utf8')).replace(
    '/uploads/AAAA/MM/',
    '/uploads/2026/11/',
  );
  const match = block.match(
    /\bdata-src="(\/wp-content\/uploads\/2026\/11\/(cubing-entrenamiento-[a-f0-9]{12}\.html))"/,
  );
  if (!match) throw new Error('Missing the versioned media URL in the Gutenberg block');
  mediaPath = match[1];
  const html = await readFile(`${media}/${match[2]}`);
  server = createServer((request, response) => {
    const { pathname } = new URL(request.url ?? '/', 'http://localhost');
    if (pathname === pagePath) {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(`<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body><h1>Entrenamiento</h1>${block}</body></html>`);
    } else if (pathname === mediaPath) {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(html);
    } else {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(() => {
  if (server) return new Promise<void>((resolve) => server.close(() => resolve()));
});

for (const [id, group, event, puzzle] of [
  ['f2l-01', 'F2L', '333', '3×3'],
  ['oll-01', 'OLL', '333', '3×3'],
  ['pll-01', 'PLL', '333', '3×3'],
  ['cll-01', 'CLL', '222', '2×2'],
  ['eg1-01', 'EG-1', '222', '2×2'],
  ['eg2-01', 'EG-2', '222', '2×2'],
  ['l4e-01', 'L4E', 'pyram', 'Pyraminx'],
  ['skewb-si-01', 'Sarah intermedio', 'skewb', 'Skewb'],
  ['skewb-sa-099', 'Sarah avanzado', 'skewb', 'Skewb'],
] as const) {
  test(`the WordPress media block passes the direct ${group} case into the standalone iframe`, async ({
    page,
  }) => {
    const outside: string[] = [];
    const errors: string[] = [];
    page.on('request', (request) => {
      const target = new URL(request.url());
      if (target.protocol === 'blob:' || target.protocol === 'data:') return;
      if (target.origin !== origin || target.pathname.startsWith('/api/'))
        outside.push(target.href);
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto(`${origin}${pagePath}?caso=${id}`);
    const frame = page.frameLocator(frameSelector);
    const caseSelect = frame.getByRole('combobox', { name: 'Caso', exact: true });
    await expect(page.locator(frameSelector)).toHaveAttribute(
      'src',
      `${origin}${mediaPath}?caso=${id}`,
    );
    await expect(caseSelect).toHaveValue(id);
    await expect(frame.getByRole('button', { name: puzzle, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(
      frame.getByRole('combobox', { name: 'Grupo', exact: true }).locator('option:checked'),
    ).toHaveText(group);
    await expect(frame.getByLabel('Preparación del caso')).toHaveText(
      getCasePreparation(getPracticeCase(id)!),
    );
    const picture = frame.locator('.scramble-picture');
    await expect(picture).toHaveAttribute('data-event', event);
    await expect(picture).toHaveAttribute('data-state', 'ready');
    await expect(frame.getByRole('button', { name: /^Cronómetro: mantén/ })).toBeEnabled();
    await expect
      .poll(() =>
        page.locator(frameSelector).evaluate((element: HTMLIFrameElement) => element.style.height),
      )
      .toMatch(/^\d+px$/);
    expect(outside).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('the mobile standalone iframe times and repeats a Skewb case, then generates normal scrambles', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(`${origin}${pagePath}?caso=skewb-si-01`);
  const frame = page.frameLocator(frameSelector);
  const timer = frame.getByRole('button', { name: /^Cronómetro: mantén/ });
  const stage = frame.locator('.cbt-stage');
  const preparation = frame.getByLabel('Preparación del caso');
  await expect(timer).toBeEnabled();
  await expect
    .poll(() =>
      frame.locator('html').evaluate((element) => element.scrollWidth - element.clientWidth),
    )
    .toBe(0);
  const moves = await preparation.textContent();
  await timer.scrollIntoViewIfNeeded();
  const box = (await timer.boundingBox())!;
  const touch = await context.newCDPSession(page);
  const touchPoints = [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }];
  await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
  await expect(stage).toHaveAttribute('data-phase', 'ready');
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(stage).toHaveAttribute('data-phase', 'running');
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(stage).toHaveAttribute('data-phase', 'stopped');
  await frame.getByRole('button', { name: 'Repetir caso', exact: true }).click();
  await expect(stage.locator('.timer-digits')).toHaveText('0.00');
  await expect(preparation).toHaveText(moves!);
  await expect(frame.getByRole('combobox', { name: 'Caso', exact: true })).toHaveValue(
    'skewb-si-01',
  );
  await expect(timer).toBeEnabled();
  await frame.getByRole('button', { name: 'Ver algoritmo', exact: true }).click();
  await expect(frame.getByLabel('Algoritmo del caso')).toBeVisible();

  await frame.getByRole('button', { name: 'Mezcla completa', exact: true }).click();
  await expect(frame.getByLabel('Mezcla actual')).not.toBeEmpty();
  await expect(frame.locator('.scramble-picture')).toHaveAttribute('data-event', 'skewb');
  for (const [event, name] of [
    ['333', '3×3'],
    ['222', '2×2'],
    ['pyram', 'Pyraminx'],
    ['skewb', 'Skewb'],
  ]) {
    await frame.getByRole('button', { name, exact: true }).click();
    const picture = frame.locator('.scramble-picture');
    await expect(frame.getByLabel('Mezcla actual')).not.toBeEmpty();
    await expect(picture).toHaveAttribute('data-event', event);
    await expect(picture).toHaveAttribute('data-state', 'ready');
    await expect(timer).toBeEnabled();
  }
  expect(
    await stage.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie]),
  ).toEqual([0, 0, '']);
});

test('an invalid WordPress link still opens the full-scramble timer in the standalone iframe', async ({
  page,
}) => {
  await page.goto(`${origin}${pagePath}?caso=oll-999`);
  const frame = page.frameLocator(frameSelector);
  await expect(frame.getByRole('combobox', { name: 'Caso', exact: true })).toBeHidden();
  await expect(frame.getByLabel('Mezcla actual')).not.toBeEmpty();
  await expect(frame.getByRole('button', { name: /^Cronómetro: mantén/ })).toBeEnabled();
});

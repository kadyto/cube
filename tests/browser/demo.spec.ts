import { expect, test, type Page, type Request } from '@playwright/test';

const timer = (page: Page) => page.getByRole('button', { name: /^Cronómetro: mantén/ });
async function ready(page: Page) {
  await expect(page.getByRole('heading', { name: 'Demo.', exact: true })).toBeVisible();
  await expect(page.getByLabel('Mezcla actual')).not.toBeEmpty();
  await expect(timer(page)).toBeEnabled();
}
async function solve(page: Page) {
  await page.locator('h1').click();
  await page.keyboard.down('Space');
  await expect(timer(page)).toContainText('¡LISTO!');
  await page.keyboard.up('Space');
  await expect(timer(page)).toContainText('A TU RITMO');
  await page.waitForTimeout(120);
  await page.keyboard.press('Space');
  await expect(page.locator('.demo-timer-footer')).toContainText('Este tiempo no se guarda.');
}

test('anonymous mobile demo times solves without login, private requests or browser storage, and resets on reload', async ({
  page,
  context,
}) => {
  const requests: { path: string; method: string; body: unknown }[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/'))
      requests.push({ path: url.pathname, method: request.method(), body: request.postDataJSON() });
  });
  await page.addInitScript(() => {
    // A private pending attempt must neither be restored by the demo nor overwritten.
    localStorage.setItem('cube-event', 'pyram');
    localStorage.setItem('cube-inspection', 'true');
    localStorage.setItem('cube-pending-v1', 'PRIVATE_PENDING_SENTINEL');
    const writes: string[] = [];
    Object.assign(window, { demoStorageWrites: writes });
    for (const method of ['setItem', 'removeItem', 'clear'] as const) {
      const original = Storage.prototype[method];
      Object.defineProperty(Storage.prototype, method, {
        value: function (...args: string[]) {
          writes.push(method);
          return (original as Function).apply(this, args);
        },
      });
    }
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Demo', exact: true }).click();
  await ready(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Inspección 15 s')).not.toBeChecked();
  await expect(page.locator('.event-tab.selected')).toContainText('3×3×3');
  await solve(page);
  await expect(page.locator('.timer-digits')).not.toHaveText('0.00');
  await expect(
    page.locator('main').getByRole('button', { name: /Guardar|Publicar|A mano|Exportar/ }),
  ).toHaveCount(0);
  await expect(page.locator('.stat-grid, .training-bottom')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/demo-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Siguiente mezcla', exact: true }).click();
  await ready(page);
  await expect(page.locator('.timer-digits')).toHaveText('0.00');
  await solve(page);
  expect(
    await page.evaluate(
      () => (window as unknown as { demoStorageWrites: string[] }).demoStorageWrites,
    ),
  ).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('cube-pending-v1'))).toBe(
    'PRIVATE_PENDING_SENTINEL',
  );
  await page.reload();
  await ready(page);
  await expect(page.locator('.timer-digits')).toHaveText('0.00');
  expect(
    await page.evaluate(
      () => (window as unknown as { demoStorageWrites: string[] }).demoStorageWrites,
    ),
  ).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('cube-pending-v1'))).toBe(
    'PRIVATE_PENDING_SENTINEL',
  );
  expect(await page.evaluate(() => localStorage.getItem('cube-event'))).toBe('pyram');
  expect(await context.cookies()).toEqual([]);
  expect(
    requests
      .filter((request) => request.method !== 'GET')
      .every(
        (request) =>
          request.path === '/api/demo/scramble' &&
          Object.keys(request.body as object).join(',') === 'event',
      ),
  ).toBe(true);
  expect(
    requests.some((request) =>
      /^\/api\/(solves|profile|scramble|publications|export|login)(?:\/|$)/.test(request.path),
    ),
  ).toBe(false);
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await page.setViewportSize({ width: 320, height: 740 });
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 320);
});

test('demo supports all puzzles, their diagrams and a touch timer while keeping private navigation locked', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/demo');
  await ready(page);
  for (const [event, name] of [
    ['333', '3×3×3'],
    ['222', '2×2×2'],
    ['pyram', 'Pyraminx'],
  ]) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('.scramble-picture')).toHaveAttribute('data-event', event);
    await expect(page.locator('.scramble-picture')).toHaveAttribute('data-state', 'ready');
    await ready(page);
  }
  const button = timer(page);
  await button.scrollIntoViewIfNeeded();
  const box = (await button.boundingBox())!;
  const touch = await page.context().newCDPSession(page);
  await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  const touchPoints = [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }];
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
  await expect(button).toContainText('¡LISTO!');
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(button).toContainText('A TU RITMO');
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.demo-timer-footer')).toContainText('Este tiempo no se guarda.');
  await page.getByRole('button', { name: 'Mi historial', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Tu contraseña');
  await page.getByRole('button', { name: 'Probar la demo sin contraseña', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Siguiente mezcla', exact: true }).click();
  await ready(page);
  await expect(page.locator('.timer-digits')).toHaveText('0.00');
});

test('an owner opening demo does not read private data or send credentials, and the private history remains intact', async ({
  page,
}) => {
  await page.request.post('/api/login', {
    headers: { 'X-Cube-Request': '1' },
    data: { password: 'a' },
  });
  const before = await (await page.request.get('/api/export')).json();
  const privateReads: string[] = [],
    demoRequests: Request[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (/^\/api\/(profile|solves)$/.test(path)) privateReads.push(path);
    if (path === '/api/demo/scramble') demoRequests.push(request);
  });
  await page.goto('/#/demo');
  await ready(page);
  await solve(page);
  expect(privateReads).toEqual([]);
  expect(
    await Promise.all(demoRequests.map(async (request) => (await request.allHeaders())['cookie'])),
  ).toEqual([undefined]);
  const after = await (await page.request.get('/api/export')).json();
  for (const key of ['profile', 'solves', 'publications']) expect(after[key]).toEqual(before[key]);
  await page.getByRole('button', { name: 'Entrenamiento', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hora de resolver.' })).toBeVisible();
  await expect(page.getByLabel('Mezcla actual')).not.toBeEmpty();
  expect(privateReads.sort()).toEqual(['/api/profile', '/api/solves']);
});

test('demo generation errors can be retried without asking for a password or saving an attempt', async ({
  page,
}) => {
  let failed = false;
  await page.route('**/api/demo/scramble', (route) => {
    if (!failed) {
      failed = true;
      return route.fulfill({
        status: 503,
        json: { error: 'No se pudo preparar la mezcla de prueba.' },
      });
    }
    return route.continue();
  });
  await page.goto('/#/demo');
  await expect(page.getByRole('alert')).toContainText('No se pudo preparar la mezcla de prueba.');
  await expect(timer(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Reintentar mezcla', exact: true }).click();
  await ready(page);
  await solve(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

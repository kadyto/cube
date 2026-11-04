import { test, expect, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar a entrenar' }).click();
  await page.getByLabel('Tu contraseña', { exact: true }).fill('a');
  await page.getByRole('dialog').getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hora de resolver.' })).toBeVisible();
  await expect(page.locator('.skip-link')).not.toBeFocused();
  await expect(page.getByLabel('Mezcla actual')).not.toBeEmpty();
}

test('mobile and desktop: manual ao5, private history, explicit publication and withdrawal', async ({
  page,
  browser,
}) => {
  await login(page);
  await page.getByText('¿Cómo se lee?', { exact: true }).click();
  await expect(page.getByText('Frontal', { exact: false })).toBeVisible();
  await page.getByText('¿Cómo se lee?', { exact: true }).click();
  await page.getByRole('button', { name: 'A mano', exact: true }).click();
  for (const time of ['10', '11,00', '12.00', '13.00', '14.00']) {
    const previous = await page.getByLabel('Mezcla actual').textContent();
    await page.getByLabel('Tu tiempo, con tu cronómetro').fill(time);
    await page.getByRole('button', { name: 'Guardar tiempo', exact: true }).click();
    await expect(page.getByLabel('Tu tiempo, con tu cronómetro')).toHaveValue('');
    await expect(page.getByLabel('Mezcla actual')).not.toHaveText(previous!);
  }
  const stat = page.locator('.stat-card').filter({ hasText: 'AO5 ACTUAL' });
  await expect(stat).toContainText('12.00');
  const visitor = await browser.newContext();
  const publicPage = await visitor.newPage();
  await publicPage.goto('/');
  await expect(publicPage.getByText('0 publicaciones', { exact: true })).toBeVisible();
  expect((await publicPage.request.get('/api/solves')).status()).toBe(401);
  await page.getByRole('button', { name: 'Mi historial', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(5);
  await page.getByRole('button', { name: '14.00', exact: true }).click();
  await page.getByRole('button', { name: 'Publicar ao5', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('12.00');
  await page.getByLabel('Título').fill('¡Mi primer ao5!');
  await page.getByRole('button', { name: 'Publicar ahora', exact: true }).click();
  await expect(page.getByRole('heading', { name: '¡Mi primer ao5!' })).toBeVisible();
  await publicPage.reload();
  await expect(publicPage.getByRole('heading', { name: '¡Mi primer ao5!' })).toBeVisible();
  await publicPage.getByRole('button', { name: /Mi primer ao5/ }).click();
  await expect(publicPage.getByRole('dialog')).toContainText('Resolución 5');
  await publicPage.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('button', { name: 'Retirar de la vitrina', exact: true }).click();
  await page.getByRole('button', { name: 'Retirar publicación', exact: true }).click();
  await expect(page.getByText('0 publicaciones', { exact: true })).toBeVisible();
  await publicPage.reload();
  await expect(publicPage.getByText('0 publicaciones', { exact: true })).toBeVisible();
  await visitor.close();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await page.screenshot({ path: 'test-results/public-mobile.png', fullPage: true });
});

test('touch timer, keyboard timer, puzzle switching and penalties', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.getByRole('button', { name: '2×2×2', exact: true }).click();
  await expect(page.getByLabel('Mezcla actual')).not.toBeEmpty();
  const timer = page.getByRole('button', { name: /^Cronómetro: mantén/ });
  await timer.scrollIntoViewIfNeeded();
  const box = (await timer.boundingBox())!;
  const touch = await page.context().newCDPSession(page);
  await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  const touchPoints = [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }];
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
  await expect(timer).toContainText('¡LISTO!');
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(timer).toContainText('A TU RITMO');
  await page.waitForTimeout(150);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.timer-footer')).toContainText('guardado en privado');
  await expect(
    page.locator('.stat-card').filter({ has: page.getByText('RESOLUCIONES', { exact: true }) }),
  ).toContainText('1');
  await page.screenshot({ path: 'test-results/training-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Pyraminx', exact: true }).click();
  await expect(page.getByLabel('Mezcla actual')).not.toBeEmpty();
  await page.getByText('¿Cómo se lee?', { exact: true }).click();
  await expect(page.getByText(/giran solo la punta/)).toBeVisible();
  await page.getByText('¿Cómo se lee?', { exact: true }).click();
  await page.locator('h1').click();
  await page.keyboard.down('Space');
  await expect(timer).toContainText('¡LISTO!');
  await page.keyboard.up('Space');
  await expect(timer).toContainText('A TU RITMO');
  await page.waitForTimeout(150);
  await page.keyboard.press('Space');
  await expect(page.locator('.timer-footer')).toContainText('guardado en privado');
  await page.getByRole('button', { name: 'Mi historial', exact: true }).click();
  await page.getByRole('button', { name: 'Pyraminx', exact: true }).click();
  await page.locator('.time-button').click();
  await page.getByRole('button', { name: '+2', exact: true }).click();
  await page.getByLabel('Nota privada').fill('Mi nota de entrenamiento');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.locator('tbody')).toContainText('+2');
  await expect(page.locator('tbody')).toContainText('Mi nota de entrenamiento');
});

test('profile settings, simple password change and authenticated session', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
  await page.getByLabel('Nombre o apodo').fill('El rincón de Leo');
  await page.getByLabel('Unas palabras sobre ti').fill('Un giro cada día.');
  await page.getByRole('button', { name: 'Guardar mi rincón', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Tu rincón se ha actualizado');
  await page.getByLabel('Contraseña actual', { exact: true }).fill('a');
  await page.getByLabel('Nueva contraseña', { exact: true }).fill('b');
  await page.getByLabel('Repite la nueva contraseña', { exact: true }).fill('b');
  await page.getByRole('button', { name: 'Cambiar contraseña', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Contraseña actualizada');
  await page.getByRole('button', { name: 'Mi rincón', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'El rincón de Leo', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/public-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).first().click();
  await page.getByRole('button', { name: 'Entrar a mi espacio', exact: true }).click();
  await page.getByLabel('Tu contraseña', { exact: true }).fill('b');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hora de resolver.' })).toBeVisible();
  // Leave the test server's password as initially configured for other tests.
  await page.request.put('/api/password', {
    headers: { 'X-Cube-Request': '1' },
    data: { currentPassword: 'b', password: 'a' },
  });
});

test('inspection applies +2 after 15 seconds and DNF after 17 seconds', async ({ page }) => {
  await login(page);
  await page.getByLabel('Inspección 15 s').check();
  await page.locator('h1').click();
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  const timer = page.getByRole('button', { name: /^Cronómetro: mantén/ });
  for (const [duration, penalty] of [
    [15000, '+2'],
    [17000, 'DNF'],
  ] as const) {
    await page.clock.fastForward(1000);
    await page.keyboard.down('Space');
    await page.clock.runFor(400);
    await page.keyboard.up('Space');
    await expect(timer).toContainText('TIEMPO DE INSPECCIÓN');
    await page.clock.fastForward(duration);
    await page.keyboard.down('Space');
    await page.clock.runFor(400);
    await page.keyboard.up('Space');
    await expect(timer).toContainText('A TU RITMO');
    await page.clock.runFor(1200);
    await page.keyboard.press('Space');
    await expect(page.locator('.timer-footer')).toContainText('guardado en privado');
    await expect(timer).toBeEnabled();
    const all = await (await page.request.get('/api/solves')).json();
    expect(all.at(-1).penalty).toBe(penalty);
    expect(all.at(-1).source).toBe('timer');
  }
});

test('a lost save response survives reload and retries without duplicating the solve', async ({
  page,
}) => {
  await login(page);
  const before = await (await page.request.get('/api/solves')).json();
  await page.route('**/api/solves', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fetch();
    await route.abort('failed');
  });
  await page.getByRole('button', { name: 'A mano', exact: true }).click();
  await page.getByLabel('Tu tiempo, con tu cronómetro').fill('17.12');
  await page.getByRole('button', { name: 'Guardar tiempo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reintentar guardado' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Reintentar guardado' })).toBeVisible();
  await page.unroute('**/api/solves');
  await page.getByRole('button', { name: 'Reintentar guardado' }).click();
  await expect(page.locator('.timer-footer')).toContainText('17.12 guardado en privado');
  const after = await (await page.request.get('/api/solves')).json();
  expect(after.length).toBe(before.length + 1);
  expect(await page.evaluate(() => localStorage.getItem('cube-pending-v1'))).toBeNull();
});

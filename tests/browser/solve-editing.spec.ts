import { expect, test, type Page } from '@playwright/test';

async function prepare(page: Page) {
  const headers = { 'X-Cube-Request': '1' };
  await page.request.post('/api/login', { headers, data: { password: 'a' } });
  const solves = await (await page.request.get('/api/solves')).json();
  for (const solve of solves)
    await page.request.delete(`/api/solves/${solve.id}`, { headers, data: {} });
}

test('individual editing and deleting are visible on mobile; the next time fills the deleted slot and recalculates ao5', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page);
  for (let i = 0; i < 5; i++) {
    const scramble = await (
      await page.request.post('/api/scramble', {
        headers: { 'X-Cube-Request': '1' },
        data: { event: '333' },
      })
    ).json();
    await page.request.post('/api/solves', {
      headers: { 'X-Cube-Request': '1' },
      data: { scrambleId: scramble.id, timeCs: 1000 + i * 100, penalty: 'none', source: 'manual' },
    });
  }
  await page.goto('/#/historial');
  await expect(page.locator('tbody tr')).toHaveCount(5);
  await page.getByRole('button', { name: 'Editar intento 3', exact: true }).click();
  await page.getByLabel('Tiempo sin penalización').fill('incorrecto');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('tiempo válido');
  await page.getByLabel('Tiempo sin penalización').fill('20,00');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(
    page
      .locator('tbody tr')
      .filter({ has: page.getByRole('button', { name: 'Editar intento 5', exact: true }) }),
  ).toContainText('12.67');
  await page.getByRole('button', { name: 'Borrar intento 3', exact: true }).click();
  await page.getByRole('button', { name: 'Sí, borrar', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(4);
  await expect(page.locator('.next-attempt')).toContainText('#3');
  await expect(page.getByRole('button', { name: 'Editar intento 4', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Entrenamiento', exact: true }).click();
  await expect(page.getByText('INTENTO #3 · TU MEZCLA')).toBeVisible();
  await page.getByRole('button', { name: 'A mano', exact: true }).click();
  await page.getByLabel('Tu tiempo, con tu cronómetro').fill('12.50');
  await page.getByRole('button', { name: 'Guardar tiempo', exact: true }).click();
  await expect(page.locator('.stat-card').filter({ hasText: 'AO5 ACTUAL' })).toContainText('12.17');
  await expect(page.getByText('INTENTO #6 · TU MEZCLA')).toBeVisible();
  await page.getByRole('button', { name: 'Mi historial', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(5);
  await expect(
    page
      .locator('tbody tr')
      .filter({ has: page.getByRole('button', { name: 'Editar intento 3', exact: true }) }),
  ).toContainText('12.50');
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/solve-actions-mobile.png', fullPage: true });
});

test('an accidental timer result can be deleted immediately, restoring its scramble and attempt number', async ({
  page,
}) => {
  await prepare(page);
  await page.goto('/#/entrenar');
  const timer = page.getByRole('button', { name: /^Cronómetro: mantén/ });
  await expect(timer).toBeEnabled();
  const scramble = await page.getByLabel('Mezcla actual').textContent();
  await page.locator('h1').click();
  await page.keyboard.down('Space');
  await expect(timer).toContainText('¡LISTO!');
  await page.keyboard.up('Space');
  await expect(timer).toContainText('A TU RITMO');
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Borrar último tiempo', exact: true }).click();
  await page.getByRole('button', { name: 'Sí, borrar', exact: true }).click();
  await expect(page.getByLabel('Mezcla actual')).toHaveText(scramble!);
  await expect(page.getByText('INTENTO #1 · TU MEZCLA')).toBeVisible();
  expect(await (await page.request.get('/api/solves')).json()).toHaveLength(0);
  await page.getByRole('button', { name: 'A mano', exact: true }).click();
  await page.getByLabel('Tu tiempo, con tu cronómetro').fill('11.11');
  await page.getByRole('button', { name: 'Guardar tiempo', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Editar último tiempo', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Editar último tiempo', exact: true }).click();
  await page.getByLabel('Tiempo sin penalización').fill('10.99');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.locator('.timer-footer')).toContainText('10.99 guardado en privado');
  const saved = await (await page.request.get('/api/solves')).json();
  expect(saved).toHaveLength(1);
  expect(saved[0].number).toBe(1);
  expect(saved[0].timeCs).toBe(1099);
  expect(saved[0].scramble).toBe(scramble);
});

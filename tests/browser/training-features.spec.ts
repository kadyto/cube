import { expect, test, type Page } from '@playwright/test';
const headers = { 'X-Cube-Request': '1' };
async function prepare(page: Page) {
  await page.request.post('/api/login', { headers, data: { password: 'a' } });
  const solves = await (await page.request.get('/api/solves')).json();
  for (const solve of solves)
    await page.request.delete(`/api/solves/${solve.id}`, { headers, data: {} });
  for (const event of ['333', '222', 'pyram']) {
    const rounds = await (await page.request.get(`/api/rounds?event=${event}`)).json();
    for (const round of rounds)
      if (!round.cancelledAt)
        await page.request.post(`/api/rounds/${round.id}/abandon`, { headers, data: {} });
  }
  const goals = await (await page.request.get('/api/goals')).json();
  for (const goal of goals)
    await page.request.delete(`/api/goals/${goal.id}`, { headers, data: {} });
  const publications = await (await page.request.get('/api/publications')).json();
  for (const publication of publications)
    await page.request.delete(`/api/publications/${publication.id}`, { headers, data: {} });
}
async function add(page: Page, timeCs: number, source = 'manual') {
  const scramble = await (
    await page.request.post('/api/scramble', { headers, data: { event: '333' } })
  ).json();
  return (
    await page.request.post('/api/solves', {
      headers,
      data: { scrambleId: scramble.id, timeCs, penalty: 'none', source },
    })
  ).json();
}
const roundPanel = (page: Page) => page.getByRole('region', { name: 'Ronda de cinco' });
async function competition(page: Page) {
  await page.goto('/#/entrenar');
  await page.getByRole('button', { name: 'Competición · 5', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Modo competición.' })).toBeVisible();
  await page.getByRole('button', { name: /^Empezar (ronda de 5|otra ronda)$/ }).click();
  await expect(roundPanel(page)).toContainText('Ahora: intento 1 de 5');
}
async function enter(page: Page, slot: number, value: string, completed = slot) {
  await page.getByLabel(`Tiempo del intento ${slot}`, { exact: true }).fill(value);
  await page.getByRole('button', { name: `Guardar intento ${slot}`, exact: true }).click();
  await expect(roundPanel(page)).toContainText(`${completed}/5 resoluciones`);
}

test('manual and web labels are visible and filters retain the original time source after editing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page);
  const manual = await add(page, 2499),
    web = await add(page, 1800, 'timer');
  await page.goto('/#/historial');
  const row = page
    .locator('tbody tr')
    .filter({ has: page.getByRole('button', { name: '24.99', exact: true }) });
  await expect(row.locator('.source-badge')).toHaveText('A mano');
  await expect(
    page
      .locator('tbody tr')
      .filter({ has: page.getByRole('button', { name: '18.00', exact: true }) })
      .locator('.source-badge'),
  ).toHaveText('Cronómetro web');
  await page.getByLabel('Filtrar por cronómetro').selectOption('manual');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: `Editar intento ${manual.number}`, exact: true }).click();
  await expect(page.getByRole('dialog').locator('.source-badge')).toHaveText('A mano');
  await page.getByLabel('Tiempo sin penalización').fill('24.50');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.locator('tbody tr')).toContainText('24.50');
  expect(
    (await (await page.request.get('/api/solves')).json()).find(
      (item: { id: string }) => item.id === manual.id,
    ).source,
  ).toBe('manual');
  expect(
    (await (await page.request.get('/api/solves')).json()).find(
      (item: { id: string }) => item.id === web.id,
    ).source,
  ).toBe('timer');
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await page.screenshot({ path: 'test-results/source-labels-mobile.png', fullPage: true });
});

test('sub-X trophies distinguish manual criteria and strict thresholds, and appear publicly only after confirmation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page);
  await add(page, 2500);
  await add(page, 1000, 'timer');
  await page.goto('/#/entrenar');
  await page.getByText('Mis objetivos y trofeos', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Contar tiempos', exact: true }).selectOption('manual');
  await page.getByRole('button', { name: 'Añadir objetivo', exact: true }).click();
  const card = page.locator('.goals-panel .goal-card').filter({ hasText: 'Sub-25' });
  await expect(card).toContainText('Objetivo pendiente');
  expect((await (await page.request.get('/api/public')).json()).achievements).toEqual([]);
  await add(page, 2499);
  await page.reload();
  await page.getByText('Mis objetivos y trofeos', { exact: true }).click();
  await expect(card).toContainText('Trofeo conseguido');
  await expect(card).toContainText('Sólo tiempos a mano');
  await page.screenshot({ path: 'test-results/goals-mobile.png', fullPage: true });
  await card.getByRole('button', { name: 'Publicar trofeo', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('24.99');
  await expect(page.getByRole('dialog').locator('.source-badge')).toHaveText('A mano');
  expect((await (await page.request.get('/api/public')).json()).achievements).toEqual([]);
  await page.getByRole('button', { name: 'Publicar este trofeo', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Mi rincón', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Trofeos compartidos' })).toContainText('Sub-25');
  await expect(page.getByRole('region', { name: 'Trofeos compartidos' })).toContainText('24.99');
  await expect(page.getByText('0 publicaciones', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retirar trofeo', exact: true }).click();
  await page.getByRole('button', { name: 'Retirar trofeo público', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Trofeos compartidos' })).toHaveCount(0);
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
});

test('competition resumes its fixed five scrambles, publishes its own ao5 explicitly and recalculates after an edit or deletion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page);
  await competition(page);
  const initial = (await (await page.request.get('/api/rounds?event=333')).json())[0];
  await enter(page, 1, '10');
  await enter(page, 2, '11');
  await page.reload();
  await expect(roundPanel(page)).toContainText('Ahora: intento 3 de 5');
  await expect(page.getByLabel('Mezcla actual')).toHaveText(initial.slots[2].scramble.alg);
  for (const [slot, time] of [
    [3, '12'],
    [4, '13'],
    [5, '14'],
  ] as const)
    await enter(page, slot, time);
  await expect(page.locator('.round-result')).toContainText('12.00');
  expect((await (await page.request.get('/api/public')).json()).publications).toHaveLength(0);
  await page.getByRole('button', { name: 'Publicar ao5 de esta ronda', exact: true }).click();
  await expect(page.getByRole('dialog').locator('.source-badge')).toHaveCount(5);
  await page.getByLabel('Título de la ronda').fill('Mi ronda de cinco');
  await page.getByRole('button', { name: 'Publicar esta ronda', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await (await page.request.get('/api/public')).json()).publications[0].result).toBe(1200);
  await roundPanel(page).getByRole('button', { name: '11.00', exact: true }).click();
  await page.getByRole('button', { name: '+2', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.locator('.round-result')).toContainText('12.67');
  await roundPanel(page).getByRole('button', { name: '12.00', exact: true }).click();
  await page.getByRole('button', { name: 'Borrar intento', exact: true }).click();
  await page.getByRole('button', { name: 'Sí, borrar', exact: true }).click();
  await expect(roundPanel(page)).toContainText('Ahora: intento 3 de 5');
  await expect(page.getByLabel('Mezcla actual')).toHaveText(initial.slots[2].scramble.alg);
  await enter(page, 3, '12.50', 5);
  await expect(page.locator('.round-result')).toContainText('12.83');
  expect((await (await page.request.get('/api/public')).json()).publications[0].result).toBe(1200);
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await page.screenshot({ path: 'test-results/competition-mobile.png', fullPage: true });
});

test('a competition save with a lost response can be confirmed after reload without duplicating a slot', async ({
  page,
}) => {
  await prepare(page);
  await competition(page);
  await page.route('**/api/solves', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fetch();
    await route.abort('failed');
  });
  await page.getByLabel('Tiempo del intento 1', { exact: true }).fill('15.20');
  await page.getByRole('button', { name: 'Guardar intento 1', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Reintentar guardado de ronda', exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.unroute('**/api/solves');
  await page.getByRole('button', { name: 'Reintentar guardado de ronda', exact: true }).click();
  await expect(roundPanel(page)).toContainText('Ahora: intento 2 de 5');
  expect(await (await page.request.get('/api/solves')).json()).toHaveLength(1);
  expect(await page.evaluate(() => localStorage.getItem('cube-round-pending-v1'))).toBeNull();
});

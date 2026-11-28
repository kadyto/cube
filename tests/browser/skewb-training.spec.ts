import { expect, test, type Page } from '@playwright/test';
import { getCasePreparation, getPracticeCase } from '../../shared/case-practice.js';
import type { Profile, Solve, TrainingRound } from '../../src/types';

const headers = { 'X-Cube-Request': '1' };
async function openTraining(page: Page) {
  const login = await page.request.post('/api/login', { headers, data: { password: 'a' } });
  expect(login.ok()).toBe(true);
  await page.goto('/#/entrenar');
  await expect(page.getByRole('heading', { name: 'Hora de resolver.' })).toBeVisible();
}

test('private Skewb solves use the timer, inspection, manual entry, editing, export and history', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openTraining(page);
  await page.getByRole('button', { name: 'Skewb', exact: true }).click();
  const picture = page.locator('.scramble-picture');
  await expect(picture).toHaveAttribute('data-event', 'skewb');
  await expect(picture).toHaveAttribute('data-state', 'ready');
  const scramble = await page.getByLabel('Mezcla actual').innerText();
  const timer = page.getByRole('button', { name: /^Cronómetro: mantén/ });
  await page.getByLabel('Inspección 15 s').check();
  await page.locator('h1').click();
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:01:00Z'));
  await page.keyboard.down('Space');
  await page.clock.runFor(400);
  await page.keyboard.up('Space');
  await expect(timer).toContainText('TIEMPO DE INSPECCIÓN');
  await page.keyboard.down('Space');
  await page.clock.runFor(400);
  await page.keyboard.up('Space');
  await page.clock.runFor(1500);
  await page.keyboard.press('Space');
  await expect(page.locator('.timer-footer')).toContainText('1.50 guardado en privado');
  await page.clock.resume();

  await page.getByRole('button', { name: 'Editar último tiempo', exact: true }).click();
  await page.getByLabel('Tiempo sin penalización').fill('9.25');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.locator('.timer-footer')).toContainText('9.25 guardado en privado');
  await expect(page.locator('.stat-card').filter({ hasText: 'MEJOR SINGLE' })).toContainText(
    '9.25',
  );

  await page.getByRole('button', { name: 'A mano', exact: true }).click();
  await page.getByLabel('Tu tiempo, con tu cronómetro').fill('18.50');
  await page.getByRole('button', { name: 'Guardar tiempo', exact: true }).click();
  await expect(page.locator('.timer-footer')).toContainText('18.50 guardado en privado');
  await expect(picture).toHaveAttribute('data-state', 'ready');
  const exported = await (await page.request.get('/api/export')).json();
  expect(exported.solves.filter((solve: Solve) => solve.event === 'skewb')).toMatchObject([
    { number: 1, timeCs: 925, penalty: 'none', source: 'timer', scramble },
    { number: 2, timeCs: 1850, source: 'manual' },
  ]);

  const fullScramble = await page.getByLabel('Mezcla actual').innerText();
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST') requests.push(new URL(request.url()).pathname);
  });
  await page.getByRole('button', { name: 'Por casos', exact: true }).click();
  const caseSelector = page.getByRole('combobox', { name: 'Caso', exact: true });
  await expect(caseSelector).toHaveValue('skewb-si-01');
  await page.getByRole('combobox', { name: 'Grupo', exact: true }).selectOption('skewb-sa');
  await caseSelector.selectOption('skewb-sa-099');
  const entry = getPracticeCase('skewb-sa-099')!;
  await expect(page.getByLabel('Preparación del caso')).toHaveText(getCasePreparation(entry));
  await expect(picture).toHaveAttribute('data-state', 'ready');
  await page.getByRole('button', { name: 'Ver algoritmo', exact: true }).click();
  await expect(page.getByLabel('Algoritmo del caso')).toHaveText(entry.algorithm);
  await page.getByLabel('Inspección 15 s').uncheck();
  await timer.scrollIntoViewIfNeeded();
  const box = (await timer.boundingBox())!;
  const touch = await context.newCDPSession(page);
  const touchPoints = [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }];
  await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
  await expect(timer).toContainText('¡LISTO!');
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(timer).toContainText('A TU RITMO');
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByRole('region', { name: 'Cronómetro del caso' })).toContainText(
    'Intento terminado',
  );
  await page.getByRole('button', { name: 'Repetir caso', exact: true }).click();
  await expect(timer).toContainText('0.00');
  await expect(caseSelector).toHaveValue('skewb-sa-099');
  await expect(page.getByLabel('Algoritmo del caso')).toBeHidden();
  expect(requests).toEqual([]);
  const afterCase = await (await page.request.get('/api/export')).json();
  for (const key of ['solves', 'rounds', 'goals', 'achievements'])
    expect(afterCase[key]).toEqual(exported[key]);
  await page.getByRole('button', { name: 'Mezcla completa', exact: true }).click();
  await expect(page.getByLabel('Mezcla actual')).toHaveText(fullScramble);

  await page.getByRole('button', { name: 'Mi historial', exact: true }).click();
  await page.getByRole('button', { name: 'Skewb', exact: true }).click();
  await page.getByLabel('Filtrar por cronómetro').selectOption('manual');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText('18.50');
  await page.getByRole('button', { name: 'Borrar intento 2', exact: true }).click();
  await page.getByRole('button', { name: 'Sí, borrar', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await expect(page.locator('.next-attempt')).toContainText('#2');
  await page.getByLabel('Filtrar por cronómetro').selectOption('timer');
  await expect(page.locator('tbody')).toContainText('9.25');
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
});

test('a pending Skewb round resumes and earns a private ao5 trophy independently of WCA', async ({
  page,
}) => {
  const wcaId = '2015BORR01';
  const official: NonNullable<Profile['wca']> = {
    id: wcaId,
    name: 'Perfil de prueba',
    country: 'ES',
    importedAt: '2026-11-04T12:00:00Z',
    personalRecords: [{ event: 'skewb', single: 475, average: 650 }],
    competitions: [
      {
        id: 'SkewbOpen2026',
        name: 'Skewb Open 2026',
        city: 'Madrid',
        country: 'ES',
        date: '2026-10-01',
        results: [
          {
            event: 'skewb',
            rounds: [{ round: 'f', position: 5, best: 475, average: 650, format: 'a' }],
          },
        ],
      },
    ],
  };
  await page.route('**/api/public', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({
      response,
      json: { ...data, profile: { ...data.profile, wcaId, wca: official } },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await openTraining(page);
  await page.getByRole('button', { name: 'Competición · 5', exact: true }).click();
  await page.getByRole('button', { name: 'Skewb', exact: true }).click();
  await page.getByRole('button', { name: 'Empezar ronda de 5', exact: true }).click();
  const roundPanel = page.getByRole('region', { name: 'Ronda de cinco' });
  await expect(roundPanel).toContainText('Ahora: intento 1 de 5');
  const rounds: TrainingRound[] = await (await page.request.get('/api/rounds?event=skewb')).json();
  const round = rounds[0];
  expect(round.slots).toHaveLength(5);
  expect(round.slots.every((slot) => slot.scramble.event === 'skewb')).toBe(true);
  for (const [slot, time] of [
    [1, '8'],
    [2, '9'],
    [3, '10'],
    [4, '11'],
    [5, '12'],
  ] as const) {
    await page.getByLabel(`Tiempo del intento ${slot}`, { exact: true }).fill(time);
    await page.getByRole('button', { name: `Guardar intento ${slot}`, exact: true }).click();
    await expect(roundPanel).toContainText(`${slot}/5 resoluciones`);
    if (slot === 1) {
      await expect(
        page.getByRole('button', { name: 'Guardar intento 2', exact: true }),
      ).toBeEnabled();
      await page.reload();
      await expect(page.getByRole('button', { name: 'Skewb', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(roundPanel).toContainText('Ahora: intento 2 de 5');
      await expect(page.getByLabel('Mezcla actual')).toHaveText(round.slots[1].scramble.alg);
    }
  }
  await expect(page.locator('.round-result')).toContainText('10.00');
  await page.getByText('Mis objetivos y trofeos', { exact: true }).click();
  const form = page.locator('.goal-form');
  await form.getByLabel('Puzzle del objetivo').selectOption('skewb');
  await form.getByLabel('Tipo de objetivo').selectOption('ao5');
  await form.getByLabel('Objetivo sub… (segundos)').fill('10.5');
  await form.getByLabel('Contar tiempos').selectOption('manual');
  await form.getByRole('radio', { name: 'Plata', exact: true }).check();
  await form.getByRole('button', { name: 'Añadir objetivo', exact: true }).click();
  const trophy = page.locator('.goal-card').filter({ hasText: 'Skewb' });
  await expect(trophy).toContainText('Trofeo conseguido');
  await expect(trophy).toContainText('10.00');
  await expect(trophy).toContainText('Plata');
  const publicBefore = await (await page.request.get('/api/public')).json();
  expect(publicBefore.publications.some((item: { event: string }) => item.event === 'skewb')).toBe(
    false,
  );
  expect(publicBefore.achievements.some((item: { event: string }) => item.event === 'skewb')).toBe(
    false,
  );
  await trophy.getByRole('button', { name: 'Publicar trofeo', exact: true }).click();
  await page.getByRole('button', { name: 'Publicar este trofeo', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Publicar ao5 de esta ronda', exact: true }).click();
  await page.getByLabel('Título de la ronda').fill('Mi ronda privada de Skewb');
  await page.getByRole('button', { name: 'Publicar esta ronda', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Mi rincón', exact: true }).click();
  const publication = page
    .locator('.publication-wrap')
    .filter({ hasText: 'Mi ronda privada de Skewb' });
  await expect(publication).toContainText('10.00');
  await expect(page.getByRole('region', { name: 'Trofeos compartidos' })).toContainText('10.00');
  const records = page.getByRole('table', { name: 'Marcas oficiales WCA' });
  await expect(records.getByRole('row', { name: 'Skewb 4.75 6.50' })).toBeVisible();
  const progress = page.getByRole('region', { name: 'Mi progreso oficial' });
  await progress.getByLabel('Prueba de las gráficas oficiales').selectOption('skewb');
  await expect(
    progress.getByRole('button', { name: /Skewb Open 2026, single 4\.75/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retirar trofeo', exact: true }).click();
  await page.getByRole('button', { name: 'Retirar trofeo público', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Trofeos compartidos' })).toHaveCount(0);
  await publication.getByRole('button', { name: 'Retirar de la vitrina', exact: true }).click();
  await page.getByRole('button', { name: 'Retirar publicación', exact: true }).click();
  await expect(publication).toHaveCount(0);
  await page.getByRole('button', { name: 'Mi historial', exact: true }).click();
  await page.getByRole('button', { name: 'Skewb', exact: true }).click();
  await page.getByLabel('Filtrar por cronómetro').selectOption('manual');
  await expect(page.locator('.history-overview')).toContainText('Mejor single 8.00');
  await expect(page.locator('.history-overview')).toContainText('Mejor ao5 10.00');
});

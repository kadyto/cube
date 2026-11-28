import { expect, test } from '@playwright/test';
import { getCasePreparation, getPracticeCase } from '../../shared/case-practice.js';
import { EVENTS } from '../../shared/domain.js';

const directCases = [
  ['f2l-01', 'F2L', '333'],
  ['oll-01', 'OLL', '333'],
  ['pll-01', 'PLL', '333'],
  ['cll-01', 'CLL', '222'],
  ['eg1-01', 'EG-1', '222'],
  ['eg2-01', 'EG-2', '222'],
  ['l4e-01', 'L4E', 'pyram'],
  ['skewb-si-01', 'Sarah intermedio', 'skewb'],
  ['skewb-sa-099', 'Sarah avanzado', 'skewb'],
] as const;

for (const [id, group, event] of directCases) {
  test(`Cube opens the direct ${group} case with a preparation and a diagram`, async ({ page }) => {
    const entry = getPracticeCase(id)!;
    const scrambleRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/demo/scramble')
        scrambleRequests.push(request.url());
    });
    await page.goto(`/?caso=${id}#/demo`);
    await expect(page.getByRole('heading', { name: 'Demo.', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: new RegExp(`^${EVENTS[event].name}`) }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByRole('combobox', { name: 'Grupo', exact: true }).locator('option:checked'),
    ).toHaveText(group);
    const selector = page.getByRole('combobox', { name: 'Caso', exact: true });
    await expect(selector).toHaveValue(id);
    await expect(selector.locator('option:checked')).toHaveText(entry.name);
    await expect(page.getByLabel('Preparación del caso')).toHaveText(getCasePreparation(entry));
    await expect(page.locator('.case-orientation')).toContainText(
      event === 'pyram'
        ? 'amarillo abajo y verde delante'
        : event === 'skewb'
          ? 'blanco arriba y verde delante'
          : 'amarillo arriba y verde delante',
    );
    await expect(page.getByLabel('Algoritmo del caso')).toBeHidden();
    const picture = page
      .getByRole('region', { name: 'Dibujo del caso' })
      .locator('.scramble-picture');
    await expect(picture).toHaveAttribute('data-event', event);
    await expect(picture).toHaveAttribute('data-state', 'ready');
    if (event === '333') {
      const centers = await picture.locator('svg').evaluate((svg) =>
        [0, 2, 5].map((slot) => {
          const center = svg.querySelector<SVGElement>(`[id="CENTERS-l${slot}-o0"]`);
          const gradient = center?.style.fill.match(/#([^"')]+)/)?.[1];
          return svg.querySelector(`[id="${gradient}"] > stop`)?.getAttribute('stop-color');
        }),
      );
      expect(centers).toEqual(['yellow', 'limegreen', 'white']);
    }
    await expect(page.getByRole('button', { name: /^Cronómetro: mantén/ })).toBeEnabled();
    await page.getByRole('button', { name: 'Ver algoritmo', exact: true }).click();
    await expect(page.getByLabel('Algoritmo del caso')).toHaveText(entry.algorithm);
    expect(scrambleRequests).toEqual([]);
  });
}

test('keyboard inspection, repetition and selection keep the demo case attempt in memory', async ({
  page,
  context,
}) => {
  await page.goto('/?caso=f2l-01#/demo');
  const timer = page.getByRole('button', { name: /^Cronómetro: mantén/ });
  const preparation = page.getByLabel('Preparación del caso');
  const caseSelect = page.getByRole('combobox', { name: 'Caso', exact: true });
  const reveal = page.getByRole('button', { name: 'Ver algoritmo', exact: true });
  const picture = page.locator('.scramble-picture');
  const diagram = picture.locator('.scramble-picture-canvas svg');
  await expect(timer).toBeEnabled();
  await expect(picture).toHaveAttribute('data-state', 'ready');
  const moves = await preparation.textContent();
  const diagramBefore = await diagram.innerHTML();
  await page.getByLabel('Inspección 15 s', { exact: true }).check();
  await reveal.focus();
  await page.keyboard.down('Space');
  await expect(timer).toContainText('¡LISTO!');
  await page.keyboard.up('Space');
  await expect(timer).toContainText('TIEMPO DE INSPECCIÓN');
  await page.keyboard.down('Space');
  await expect(timer).toContainText('Preparado');
  await page.keyboard.up('Space');
  await expect(timer).toContainText('A TU RITMO');
  await page.keyboard.press('Space');
  await expect(page.locator('.demo-timer-footer')).toContainText('Este tiempo no se guarda.');
  await expect(page.getByLabel('Algoritmo del caso')).toBeHidden();

  await page.getByRole('button', { name: 'Repetir caso', exact: true }).click();
  await expect(caseSelect).toHaveValue('f2l-01');
  await expect(preparation).toHaveText(moves!);
  expect(await diagram.innerHTML()).toBe(diagramBefore);
  await expect(page.locator('.timer-digits')).toHaveText('0.00');
  await expect(timer).toBeEnabled();

  const groupSelect = page.getByRole('combobox', { name: 'Grupo', exact: true });
  await groupSelect.selectOption({ label: 'OLL' });
  await caseSelect.selectOption('oll-02');
  await expect(caseSelect).toHaveValue('oll-02');
  await expect(preparation).not.toHaveText(moves!);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  expect(await context.cookies()).toEqual([]);
});

test('invalid links fall back to a scramble and each puzzle offers its own case families', async ({
  page,
}) => {
  await page.goto('/?caso=f2l-999#/demo');
  const timer = page.getByRole('button', { name: /^Cronómetro: mantén/ });
  const practice = page.getByRole('button', { name: 'Por casos', exact: true });
  await expect(page.getByLabel('Mezcla actual')).not.toBeEmpty();
  await expect(page.getByRole('combobox', { name: 'Caso', exact: true })).toBeHidden();
  await expect(timer).toBeEnabled();
  await practice.click();
  await expect(page.getByRole('combobox', { name: 'Caso', exact: true })).toBeVisible();
  const groupOptions = page.getByRole('combobox', { name: 'Grupo', exact: true }).locator('option');
  for (const [event, names] of [
    ['333', ['F2L', 'OLL', 'PLL']],
    ['222', ['CLL', 'EG-1', 'EG-2']],
    ['pyram', ['L4E']],
    ['skewb', ['Sarah intermedio', 'Sarah avanzado']],
  ] as const) {
    await page.getByRole('button', { name: new RegExp(`^${EVENTS[event].name}`) }).click();
    await expect(groupOptions).toHaveText([...names]);
    await expect(page.locator('.scramble-picture')).toHaveAttribute('data-event', event);
    await page.getByRole('button', { name: 'Mezcla completa', exact: true }).click();
    await expect(page.getByLabel('Mezcla actual')).not.toBeEmpty();
    await expect(page.locator('.scramble-picture')).toHaveAttribute('data-event', event);
    await expect(page.locator('.scramble-picture')).toHaveAttribute('data-state', 'ready');
    await expect(timer).toBeEnabled();
    await practice.click();
  }
});

test('a mobile 2×2 case can be timed by touch and repeated', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/?caso=eg2-01#/demo');
  const timer = page.getByRole('button', { name: /^Cronómetro: mantén/ });
  const preparation = page.getByLabel('Preparación del caso');
  const sequence = await preparation.innerText();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 320);
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
  await expect(page.locator('.demo-timer-footer')).toContainText('Este tiempo no se guarda.');
  await page.getByRole('button', { name: 'Repetir caso', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Caso', exact: true })).toHaveValue('eg2-01');
  await expect(preparation).toHaveText(sequence);
  await expect(page.locator('.timer-digits')).toHaveText('0.00');
});

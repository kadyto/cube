import { expect, test } from '@playwright/test';
import { getCasePreparation, getPracticeCase } from '../../shared/case-practice.js';

const directCases = [
  ['f2l-01', 'F2L'],
  ['oll-01', 'OLL'],
  ['pll-01', 'PLL'],
] as const;

for (const [id, group] of directCases) {
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
      page.getByRole('combobox', { name: 'Grupo', exact: true }).locator('option:checked'),
    ).toHaveText(group);
    const selector = page.getByRole('combobox', { name: 'Caso', exact: true });
    await expect(selector).toHaveValue(id);
    await expect(selector.locator('option:checked')).toHaveText(entry.name);
    await expect(page.getByLabel('Preparación del caso')).toHaveText(getCasePreparation(entry));
    await expect(page.locator('.case-orientation')).toContainText(
      'amarillo arriba y verde delante',
    );
    await expect(page.getByLabel('Algoritmo del caso')).toBeHidden();
    const picture = page
      .getByRole('region', { name: 'Dibujo del caso' })
      .locator('.scramble-picture');
    await expect(picture).toHaveAttribute('data-event', '333');
    await expect(picture).toHaveAttribute('data-state', 'ready');
    const centers = await picture.locator('svg').evaluate((svg) =>
      [0, 2, 5].map((slot) => {
        const center = svg.querySelector<SVGElement>(`[id="CENTERS-l${slot}-o0"]`);
        const gradient = center?.style.fill.match(/#([^"')]+)/)?.[1];
        return svg.querySelector(`[id="${gradient}"] > stop`)?.getAttribute('stop-color');
      }),
    );
    expect(centers).toEqual(['yellow', 'limegreen', 'white']);
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

test('an invalid case link falls back to a usable scramble and cases are offered only for 3×3', async ({
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
  await page.getByRole('button', { name: 'Mezcla completa', exact: true }).click();

  for (const [event, name] of [
    ['333', '3×3×3'],
    ['222', '2×2×2'],
    ['pyram', 'Pyraminx'],
  ]) {
    await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await expect(page.getByLabel('Mezcla actual')).not.toBeEmpty();
    await expect(page.locator('.scramble-picture')).toHaveAttribute('data-event', event);
    await expect(page.locator('.scramble-picture')).toHaveAttribute('data-state', 'ready');
    await expect(timer).toBeEnabled();
  }
  await expect(practice).toBeHidden();
});

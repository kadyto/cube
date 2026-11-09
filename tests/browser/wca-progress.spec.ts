import { expect, test, type Page } from '@playwright/test';

const round = (best: number, average: number | null, id = '1', format = 'a') => ({
  round: id,
  position: 8,
  best,
  average,
  format,
});
const competition = (
  id: string,
  name: string,
  date: string,
  results: { event: string; rounds: ReturnType<typeof round>[] }[],
) => ({ id, name, date, city: 'Madrid', country: 'ES', results });
const first = competition('Winter2026', 'Winter Open 2026', '2026-01-10', [
  { event: '333', rounds: [round(2200, 2800), round(2300, 2600, 'f')] },
  { event: 'pyram', rounds: [round(500, null)] },
]);
const failed = competition('Spring2026', 'Spring Open 2026', '2026-04-10', [
  { event: '333', rounds: [round(-1, -2)] },
]);
const summer = competition('Summer2026', 'Summer Open 2026', '2026-06-10', [
  { event: '333', rounds: [round(2000, 2500)] },
]);
const latest = competition('Autumn2026', 'Autumn Open 2026', '2026-11-01', [
  { event: '333', rounds: [round(1900, 2300), round(1800, 2400, 'f')] },
  { event: '666', rounds: [round(6060, 7000, 'f', 'm')] },
  { event: '333fm', rounds: [round(28, 2967, 'f', 'm')] },
  { event: '333mbf', rounds: [round(880600001, null, 'f', '3')] },
]);
// Deliberately unordered: charts and table must both follow the actual competition dates.
const competitions = [latest, first, summer, failed];
const profile = {
  name: 'Mi progreso',
  bio: '',
  wcaId: '2015BORR01',
  wca: {
    id: '2015BORR01',
    name: 'Perfil de prueba',
    country: 'ES',
    importedAt: '2026-11-09T10:00:00Z',
    personalRecords: [],
    competitions,
  },
};
const progress = (page: Page) => page.getByRole('region', { name: 'Mi progreso oficial' });
const chart = (page: Page, metric: 'single' | 'media', event = '3×3×3') =>
  progress(page).getByRole('group', {
    name: `Evolución ${metric === 'single' ? 'del single' : 'de la media'} oficial de ${event}`,
    exact: true,
  });

test('official progress keeps independent best rounds, chronological results and real gaps on mobile and desktop', async ({
  page,
}) => {
  const privateRequests: string[] = [];
  page.on('request', (request) => {
    if (/\/api\/(solves|profile)(?:\?|$)/.test(request.url())) privateRequests.push(request.url());
  });
  await page.route('**/api/auth', (route) => route.fulfill({ json: { authenticated: false } }));
  await page.route('**/api/public', (route) =>
    route.fulfill({ json: { profile, publications: [] } }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const section = progress(page);
  await expect(section.getByRole('heading', { name: 'Single oficial', exact: true })).toBeVisible();
  await expect(section.getByRole('heading', { name: 'ao5 oficial', exact: true })).toBeVisible();
  for (const metric of ['single', 'media'] as const) {
    await expect(chart(page, metric).getByRole('button')).toHaveCount(3);
    // The DNF/DNS in April separates January from the June-November segment.
    const line = chart(page, metric).locator('.official-progress-line');
    await expect(line).toHaveCount(1);
    expect((await line.getAttribute('points'))?.trim().split(/\s+/)).toHaveLength(2);
  }
  const detail = section.locator('.official-progress-detail');
  await chart(page, 'single')
    .getByRole('button', { name: /Winter Open 2026, single 22\.00/ })
    .click();
  await expect(detail).toContainText('Winter Open 2026');
  await expect(detail).toContainText('22.00');
  await expect(detail).toContainText('26.00');
  await expect(detail).toContainText('Primera ronda');
  await expect(detail).toContainText('Final');
  await expect(detail.getByRole('link', { name: 'Ver resultados en WCA' })).toHaveAttribute(
    'href',
    /worldcubeassociation\.org\/competitions\/Winter2026/,
  );
  const last = chart(page, 'media').getByRole('button', { name: /Autumn Open 2026, media 23\.00/ });
  await last.focus();
  await last.press('Enter');
  await expect(detail).toContainText('Autumn Open 2026');
  await expect(detail).toContainText('18.00');
  await expect(detail).toContainText('23.00');
  await section.getByText('Ver todos los resultados oficiales', { exact: true }).click();
  const table = section.getByRole('table', { name: 'Historial de progreso oficial' });
  const rows = table.locator('tbody tr');
  await expect(rows).toHaveCount(4);
  for (const [index, name] of ['Winter', 'Spring', 'Summer', 'Autumn'].entries())
    await expect(rows.nth(index)).toContainText(`${name} Open 2026`);
  await expect(rows.nth(1)).toContainText('DNF');
  await expect(rows.nth(1)).toContainText('DNS');
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await section.screenshot({ path: 'test-results/wca-progress-mobile.png' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 1280);
  await section.screenshot({ path: 'test-results/wca-progress-desktop.png' });
  expect(privateRequests).toEqual([]);
});

test('categories with one point, no average, mo3, FMC and multi-blind keep official result meanings', async ({
  page,
}) => {
  await page.route('**/api/public', (route) =>
    route.fulfill({ json: { profile, publications: [] } }),
  );
  await page.goto('/');
  const section = progress(page);
  const selector = section.getByLabel('Prueba de las gráficas oficiales', { exact: true });
  await selector.selectOption('pyram');
  await expect(chart(page, 'single', 'Pyraminx').getByRole('button')).toHaveCount(1);
  await expect(chart(page, 'media', 'Pyraminx').getByRole('button')).toHaveCount(0);
  await expect(section.locator('.official-progress-line')).toHaveCount(0);
  await expect(section.locator('.official-progress-detail')).toContainText('5.00');
  await section.getByText('Ver todos los resultados oficiales', { exact: true }).click();
  let row = section
    .getByRole('table', { name: 'Historial de progreso oficial' })
    .locator('tbody tr');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('—');
  await selector.selectOption('666');
  await expect(section.getByRole('heading', { name: 'mo3 oficial', exact: true })).toBeVisible();
  await expect(section.locator('.official-progress-detail')).toContainText('1:00.60');
  await expect(section.locator('.official-progress-detail')).toContainText('1:10.00');
  await selector.selectOption('333fm');
  await expect(section.locator('.official-progress-detail')).toContainText('28 mov.');
  await expect(section.locator('.official-progress-detail')).toContainText('29.67 mov.');
  await selector.selectOption('333mbf');
  await expect(section.locator('svg[role="group"]')).toHaveCount(0);
  row = section.getByRole('table', { name: 'Historial de progreso oficial' }).locator('tbody tr');
  await expect(row).toHaveCount(1);
  await expect(row).not.toContainText('880600001');
});

test('home refresh updates official chart data and resets a category that disappears without exposing hidden competitions', async ({
  page,
}) => {
  let refresh = false;
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.route('**/api/public', (route) =>
    route.fulfill({
      json: {
        profile: {
          ...profile,
          wca: {
            ...profile.wca,
            competitions: refresh
              ? [
                  competition('New2026', 'New Open 2026', '2026-11-09', [
                    { event: '333', rounds: [round(1700, 2100)] },
                  ]),
                ]
              : [first],
          },
        },
        publications: [],
      },
    }),
  );
  await page.goto('/');
  await progress(page).getByLabel('Prueba de las gráficas oficiales').selectOption('pyram');
  await expect(chart(page, 'single', 'Pyraminx').getByRole('button')).toHaveCount(1);
  refresh = true;
  await page.clock.fastForward(60000);
  await expect(progress(page).getByLabel('Prueba de las gráficas oficiales')).toHaveValue('333');
  await expect(progress(page).locator('.official-progress-detail')).toContainText('New Open 2026');
  await expect(progress(page).locator('.official-progress-detail')).toContainText('17.00');
  await page.route('**/api/public', (route) =>
    route.fulfill({
      json: {
        profile: { ...profile, wca: { ...profile.wca, competitions: [] } },
        publications: [],
      },
    }),
  );
  await page.reload();
  await expect(progress(page)).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Mi recorrido en competición' })).toHaveCount(0);
});

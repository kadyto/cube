import { expect, test } from '@playwright/test';

const competitions = Array.from({ length: 7 }, (_, i) => ({
  id: `Open${i + 1}2026`,
  name: `Open ${i + 1} 2026`,
  city: 'Madrid',
  country: 'ES',
  date: `2026-0${i + 1}-10`,
  results: [
    {
      event: '333',
      rounds: [
        { round: '1', position: 1, best: 1200, average: 1400 },
        { round: 'f', position: i === 5 ? 2 : 8, best: 1100, average: 1300 },
      ],
    },
    ...(i === 6
      ? [{ event: 'pyram', rounds: [{ round: '1', position: 3, best: 500, average: -1 }] }]
      : []),
  ],
}));
const profile = {
  name: 'Mi rincón',
  bio: 'Mis competiciones',
  wcaId: '2015BORR01',
  wca: {
    id: '2015BORR01',
    name: 'Perfil de prueba',
    country: 'ES',
    competitions,
    personalRecords: [],
    importedAt: '2026-11-04T12:00:00Z',
  },
};

test('timeline shows latest-round positions, expands previous rounds, filters events, and loads more competitions', async ({
  page,
}) => {
  await page.route('**/api/public', (route) =>
    route.fulfill({ json: { profile, publications: [] } }),
  );
  await page.goto('/');
  const timeline = page.getByRole('region', { name: 'Mi recorrido en competición' });
  await expect(timeline.locator('.timeline-card')).toHaveCount(3);
  const latest = timeline.locator('.timeline-card').first();
  await expect(latest.getByRole('link', { name: 'Open 7 2026' })).toBeVisible();
  await expect(latest.locator('.position-pill').first()).toContainText('8.º');
  await expect(latest.locator('.position-pill').first()).toContainText('Final');
  await expect(latest.locator('.podium')).toHaveCount(0);
  await expect(timeline.locator('.podium')).toHaveCount(1);
  await latest.getByText('Ver las 2 rondas').click();
  await expect(latest.getByText('Puesto 1', { exact: true })).toBeVisible();
  await expect(latest.getByText('Puesto 8', { exact: true })).toBeVisible();
  await timeline.getByRole('button', { name: 'Ver más competiciones (4)' }).click();
  await expect(timeline.locator('.timeline-card')).toHaveCount(6);
  await timeline.getByRole('button', { name: 'Ver más competiciones (1)' }).click();
  await expect(timeline.locator('.timeline-card')).toHaveCount(7);
  await page.getByLabel('Filtrar competiciones por prueba').selectOption('pyram');
  await expect(timeline.locator('.timeline-card')).toHaveCount(1);
  await expect(timeline.locator('.position-pill')).toContainText('3.º');
  await expect(timeline.locator('.position-pill')).toContainText('Primera ronda');
  await expect(timeline.locator('.podium')).toHaveCount(0);
  await expect(timeline.getByText('DNF', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await expect(page.locator('.brand-logo')).toBeVisible();
  await expect(page.locator('.hero-art .big-cube')).toBeVisible();
  await expect
    .poll(() => page.locator('.brand-logo').evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/logo.png');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/timeline-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByLabel('Filtrar competiciones por prueba').selectOption('all');
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 1280);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/timeline-desktop.png', fullPage: true });
});

test('legacy competitions remain visible and explain that positions need refreshing', async ({
  page,
}) => {
  const legacy = { ...competitions[0], results: null };
  await page.route('**/api/public', (route) =>
    route.fulfill({
      json: {
        profile: { ...profile, wca: { ...profile.wca, competitions: [legacy] } },
        publications: [],
      },
    }),
  );
  await page.goto('/');
  await expect(
    page.getByText('Los puestos de estas competiciones se actualizarán automáticamente.'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open 1 2026' })).toBeVisible();
  await expect(page.getByText('Puestos pendientes de importar.')).toBeVisible();
  await expect(page.locator('.position-pill')).toHaveCount(0);
});

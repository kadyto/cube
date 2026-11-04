import { expect, test } from '@playwright/test';

const profile = {
  name: 'Mi perfil de cubos',
  bio: 'Mi presentación',
  wcaId: '2015BORR01',
  wca: {
    id: '2015BORR01',
    name: 'Perfil de prueba',
    country: 'ES',
    competitions: [],
    importedAt: '2026-11-04T12:00:00.000Z',
    personalRecords: [
      { event: '333', single: 987, average: 1234 },
      { event: '222', single: 321, average: null },
      { event: '444', single: 6245, average: 7000 },
      { event: 'pyram', single: 500, average: 700 },
    ],
  },
};

test('home starts with the banner and displays official WCA single and average records on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/public', (route) =>
    route.fulfill({ json: { profile, publications: [] } }),
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Mi perfil de cubos', level: 1 })).toBeVisible();
  await expect(page.locator('#main-content > .page-heading')).toHaveCount(0);
  const records = page.getByRole('table', { name: 'Marcas oficiales WCA' });
  await expect(records.getByRole('row', { name: '3×3×3 9.87 12.34' })).toBeVisible();
  await expect(records.getByRole('row', { name: '2×2×2 3.21 —' })).toBeVisible();
  await expect(records.getByRole('row', { name: '4×4×4 1:02.45 1:10.00' })).toBeVisible();
  await expect(records.getByRole('row', { name: 'Pyraminx 5.00 7.00' })).toBeVisible();
  for (const text of [
    'PEQUEÑOS GIROS. GRANDES LOGROS.',
    'Un rincón para compartir',
    'La alegría de resolver. El orgullo de seguir mejorando.',
    'El mejor tiempo es el que te anima a volver a intentarlo.',
  ])
    await expect(page.getByText(text, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Marcas compartidas' })).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await page.screenshot({ path: 'test-results/wca-records-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(records).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 1280);
  await page.screenshot({ path: 'test-results/wca-records-desktop.png', fullPage: true });
});

test('old imported profiles explain that records need to be refreshed', async ({ page }) => {
  await page.route('**/api/public', (route) =>
    route.fulfill({
      json: {
        profile: { ...profile, wca: { ...profile.wca, personalRecords: null } },
        publications: [],
      },
    }),
  );
  await page.goto('/');
  await expect(
    page.getByText('Las marcas oficiales se cargarán en la próxima actualización automática.'),
  ).toBeVisible();
  await expect(page.getByRole('table', { name: 'Marcas oficiales WCA' })).toHaveCount(0);
});

test('an imported profile with no official results shows an empty state', async ({ page }) => {
  await page.route('**/api/public', (route) =>
    route.fulfill({
      json: {
        profile: { ...profile, wca: { ...profile.wca, personalRecords: [] } },
        publications: [],
      },
    }),
  );
  await page.goto('/');
  await expect(page.getByText('Este perfil todavía no tiene marcas oficiales WCA.')).toBeVisible();
});

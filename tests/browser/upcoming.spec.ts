import { expect, test } from '@playwright/test';

const upcoming = {
  fetchedAt: '2026-11-05T12:00:00Z',
  competitions: [
    {
      id: 'Future2026',
      name: 'Próximo Open 2026',
      city: 'Madrid',
      country: 'ES',
      date: '2026-11-07',
      endDate: '2026-11-08',
      forecast: {
        calculatedAt: '2026-11-05T12:00:00Z',
        notice: null,
        error: null,
        eventIds: ['333', 'pyram'],
        estimates: [
          {
            event: '333',
            basis: 'average',
            ownBest: 1500,
            total: 42,
            comparable: 37,
            missing: 5,
            positionMin: 12,
            positionMax: 17,
            tied: 1,
            reason: null,
          },
          {
            event: 'pyram',
            basis: 'average',
            ownBest: null,
            total: 30,
            comparable: 29,
            missing: 1,
            positionMin: null,
            positionMax: null,
            tied: 0,
            reason: 'Todavía no tienes una media oficial comparable.',
          },
        ],
      },
    },
  ],
};
const profile = {
  name: 'Mi rincón',
  bio: '',
  wcaId: '2026TEST01',
  showWca: false,
  showCompetitions: false,
  showUpcoming: false,
  calculateForecasts: false,
  wca: {
    id: '2026TEST01',
    name: 'Perfil WCA',
    country: 'ES',
    competitions: [],
    personalRecords: [],
    importedAt: '2026-11-05T12:00:00Z',
  },
};

test('public upcoming competitions explain PB ranges, ties and missing records on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/public', (route) =>
    route.fulfill({
      json: { profile: { ...profile, wca: { ...profile.wca, upcoming } }, publications: [] },
    }),
  );
  await page.goto('/');
  const widget = page.getByRole('region', { name: 'Próximas competiciones' });
  await expect(widget.getByRole('link', { name: 'Próximo Open 2026' })).toHaveAttribute(
    'href',
    'https://www.worldcubeassociation.org/competitions/Future2026',
  );
  await expect(widget).toContainText('12.º–17.º de 42');
  await expect(widget).toContainText(
    '37 de 42 inscritos con marca comparable · 5 sin referencia · 1 con tu misma marca',
  );
  await expect(widget).toContainText('Tu media oficial: 15.00');
  await expect(widget).toContainText('Todavía no tienes una media oficial comparable.');
  await expect(widget).toContainText('No predice el resultado real.');
  await expect(widget).toContainText('Corte de marcas:');
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await page.screenshot({ path: 'test-results/upcoming-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 1280);
  await page.screenshot({ path: 'test-results/upcoming-desktop.png', fullPage: true });
});

test('upcoming visibility and daily comparison start disabled and take effect only after saving', async ({
  page,
}) => {
  let saved = { ...profile };
  let cuts = 0;
  await page.route('**/api/auth', (route) => route.fulfill({ json: { authenticated: true } }));
  await page.route('**/api/profile', (route) => {
    if (route.request().method() === 'PUT') saved = route.request().postDataJSON();
    return route.fulfill({ json: saved });
  });
  await page.route('**/api/solves', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/public', (route) =>
    route.fulfill({
      json: { profile: { name: 'Mi rincón', bio: '', wcaId: '', wca: null }, publications: [] },
    }),
  );
  await page.route('**/api/wca/status', (route) =>
    route.fulfill({ json: { id: profile.wcaId, enabled: false } }),
  );
  const status = () => ({
    ...upcoming,
    id: profile.wcaId,
    error: null,
    refreshing: false,
    competitions: saved.calculateForecasts
      ? upcoming.competitions
      : upcoming.competitions.map((comp) => ({ ...comp, forecast: null })),
    forecast: {
      enabled: saved.calculateForecasts,
      refreshing: false,
      lastAttemptAt: cuts ? upcoming.fetchedAt : null,
      calculatedAt: cuts ? upcoming.fetchedAt : null,
      nextAllowedAt: '2026-11-06T12:00:00Z',
      error: null,
    },
  });
  await page.route('**/api/upcoming', (route) => route.fulfill({ json: status() }));
  await page.route('**/api/upcoming/refresh', (route) => {
    if (saved.calculateForecasts) cuts = 1;
    return route.fulfill({ json: status() });
  });
  await page.goto('/#/ajustes');
  const visibility = page.getByLabel(
    'Mostrar en público las próximas competiciones con inscripción aceptada',
  );
  const comparison = page.getByLabel(
    'Calcular una referencia de puesto por marcas oficiales cada 24 horas',
  );
  await expect(visibility).not.toBeChecked();
  await expect(visibility).toBeDisabled();
  await expect(comparison).not.toBeChecked();
  await expect(page.locator('.upcoming-settings')).toContainText('Esta sección solo la ves tú.');
  await comparison.check();
  await expect(page.locator('.upcoming-settings')).toContainText(
    'La comparación por marcas está desactivada.',
  );
  await page
    .getByLabel('Mostrar mi perfil WCA, mi nombre y mis marcas oficiales en público')
    .check();
  await visibility.check();
  await page.getByRole('button', { name: 'Guardar mi rincón', exact: true }).click();
  await expect(page.locator('.upcoming-settings')).toContainText('Visible en tu rincón público.');
  await page.getByRole('button', { name: 'Actualizar inscripciones', exact: true }).click();
  await expect(page.locator('.upcoming-settings')).toContainText(
    'Próximo corte disponible a partir de',
  );
  await expect(page.locator('.upcoming-settings')).toContainText('12.º–17.º de 42');
  expect(saved.showUpcoming).toBe(true);
  expect(saved.calculateForecasts).toBe(true);
  await page.getByRole('button', { name: 'Actualizar inscripciones', exact: true }).click();
  expect(cuts).toBe(1);
});

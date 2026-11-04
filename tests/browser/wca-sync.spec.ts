import { expect, test } from '@playwright/test';

const wca = {
  id: '2015BORR01',
  name: 'Perfil de prueba',
  country: 'ES',
  importedAt: '2026-11-04T12:00:00Z',
  personalRecords: [{ event: '333', single: 1234, average: 1500 }],
  competitions: [],
};

test('an open home automatically picks up new official results without reloading', async ({
  page,
}) => {
  let requests = 0;
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.route('**/api/public', (route) => {
    requests++;
    return route.fulfill({
      json: {
        profile: {
          name: 'Mi rincón',
          bio: '',
          wcaId: wca.id,
          wca:
            requests === 1
              ? wca
              : {
                  ...wca,
                  personalRecords: [{ event: '333', single: 1100, average: 1400 }],
                  competitions: [
                    {
                      id: 'New2026',
                      name: 'Nueva competición 2026',
                      city: 'Madrid',
                      country: 'ES',
                      date: '2026-11-01',
                      results: [
                        {
                          event: '333',
                          rounds: [{ round: 'f', position: 2, best: 1100, average: 1400 }],
                        },
                      ],
                    },
                  ],
                },
        },
        publications: [],
      },
    });
  });
  await page.goto('/');
  await expect(page.getByRole('table', { name: 'Marcas oficiales WCA' })).toContainText('12.34');
  await page.clock.fastForward(60000);
  await expect(page.getByRole('table', { name: 'Marcas oficiales WCA' })).toContainText('11.00');
  await expect(page.getByRole('link', { name: 'Nueva competición 2026' })).toBeVisible();
  await expect(page.locator('.position-pill')).toContainText('2.º');
  expect(requests).toBeGreaterThan(1);
});

test('settings display automatic refresh status and preserve an unsaved profile edit', async ({
  page,
}) => {
  await page.route('**/api/auth', (route) => route.fulfill({ json: { authenticated: true } }));
  await page.route('**/api/profile', (route) =>
    route.fulfill({
      json: {
        name: 'Mi apodo',
        bio: '',
        wcaId: wca.id,
        showWca: false,
        showCompetitions: false,
        wca,
      },
    }),
  );
  await page.route('**/api/solves', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/public', (route) =>
    route.fulfill({
      json: { profile: { name: 'Mi apodo', bio: '', wcaId: '', wca: null }, publications: [] },
    }),
  );
  await page.route('**/api/wca/status', (route) =>
    route.fulfill({
      json: {
        id: wca.id,
        enabled: true,
        intervalMinutes: 60,
        refreshing: false,
        lastSuccessAt: '2026-11-04T12:00:00Z',
        lastAttemptAt: '2026-11-04T13:00:00Z',
        nextRefreshAt: '2026-11-04T13:15:00Z',
        error: 'La WCA no está disponible ahora.',
      },
    }),
  );
  await page.goto('/#/ajustes');
  await expect(page.getByText('Actualización automática cada hora', { exact: true })).toBeVisible();
  await expect(page.locator('.wca-sync-info')).toContainText('Última actualización:');
  await expect(page.locator('.wca-sync-info')).toContainText('Reintentaremos automáticamente');
  await page.getByLabel('Nombre o apodo').fill('Apodo todavía sin guardar');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByLabel('Nombre o apodo')).toHaveValue('Apodo todavía sin guardar');
  await expect(
    page.getByLabel('Mostrar mi perfil WCA, mi nombre y mis marcas oficiales en público'),
  ).not.toBeChecked();
});

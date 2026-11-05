import { expect, test, type Page } from '@playwright/test';

type WakeLockProbe = {
  requests: string[];
  active: number;
  releases: number;
  deny: boolean;
  defer: boolean;
  finishNext: () => void;
  releaseFromSystem: () => void;
  visibility: (state: DocumentVisibilityState) => void;
};
declare global {
  interface Window {
    wakeLockProbe: WakeLockProbe;
  }
}

async function mockWakeLock(page: Page, options = { deny: false, defer: false }) {
  await page.addInitScript(({ deny, defer }) => {
    const locks: { release: () => Promise<void> }[] = [],
      waiting: (() => void)[] = [];
    let visibility: DocumentVisibilityState = 'visible';
    const probe = (window.wakeLockProbe = {
      requests: [],
      active: 0,
      releases: 0,
      deny,
      defer,
      finishNext() {
        waiting.shift()?.();
      },
      releaseFromSystem() {
        for (const lock of locks) void lock.release();
      },
      visibility(state) {
        visibility = state;
        document.dispatchEvent(new Event('visibilitychange'));
      },
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    });
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        async request(type: string) {
          probe.requests.push(type);
          if (probe.defer) await new Promise<void>((resolve) => waiting.push(resolve));
          if (probe.deny) throw new DOMException('Blocked by the system', 'NotAllowedError');
          const lock = new (class extends EventTarget {
            released = false;
            readonly type = 'screen';
            async release() {
              if (this.released) return;
              this.released = true;
              probe.active--;
              probe.releases++;
              this.dispatchEvent(new Event('release'));
            }
          })();
          locks.push(lock);
          probe.active++;
          return lock;
        },
      },
    });
  }, options);
}

async function login(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar a entrenar', exact: true }).click();
  await page.getByLabel('Tu contraseña', { exact: true }).fill('a');
  await page.getByRole('dialog').getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hora de resolver.' })).toBeVisible();
  await expect(page.getByLabel('Mezcla actual')).not.toBeEmpty();
}
const activeLocks = (page: Page) => page.evaluate(() => window.wakeLockProbe.active);
const requests = (page: Page) => page.evaluate(() => window.wakeLockProbe.requests);

test('mobile training holds one screen lock while reading a scramble, inspecting, timing and entering manually; leaving releases it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockWakeLock(page);
  await page.goto('/');
  expect(await requests(page)).toEqual([]);
  await login(page);
  await expect(page.locator('.screen-awake')).toHaveText(
    'Pantalla encendida durante el entrenamiento',
  );
  await expect.poll(() => activeLocks(page)).toBe(1);
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.clock.fastForward(180000); // Reading a scramble needs the lock even during inactivity.
  expect(await requests(page)).toEqual(['screen']);
  expect(await activeLocks(page)).toBe(1);

  await page.getByLabel('Inspección 15 s').check();
  await page.locator('h1').click();
  const timer = page.getByRole('button', { name: /^Cronómetro: mantén/ });
  await page.keyboard.down('Space');
  await page.clock.runFor(400);
  await page.keyboard.up('Space');
  await expect(timer).toContainText('TIEMPO DE INSPECCIÓN');
  await page.clock.runFor(1000);
  expect(await activeLocks(page)).toBe(1);
  await page.keyboard.down('Space');
  await page.clock.runFor(400);
  await page.keyboard.up('Space');
  await expect(timer).toContainText('A TU RITMO');
  await page.clock.runFor(1200);
  expect(await activeLocks(page)).toBe(1);
  await page.keyboard.press('Space');
  await expect(page.locator('.timer-footer')).toContainText('guardado en privado');
  await expect(timer).toBeEnabled();
  await page.getByRole('button', { name: 'A mano', exact: true }).click();
  await page.getByLabel('Tu tiempo, con tu cronómetro').fill('12.34');
  await page.getByRole('button', { name: '2×2×2', exact: true }).click();
  await expect(page.getByLabel('Mezcla actual')).not.toBeEmpty();
  expect(await requests(page)).toEqual(['screen']);
  expect(await activeLocks(page)).toBe(1);
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await page.screenshot({ path: 'test-results/screen-awake-mobile.png', fullPage: true });

  await page.getByRole('button', { name: 'Mi historial', exact: true }).click();
  await expect.poll(() => activeLocks(page)).toBe(0);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.getByRole('button', { name: 'Mi rincón', exact: true }).click();
  expect(await requests(page)).toEqual(['screen']);
});

test('returning from a hidden page or page cache recovers the lock, and system revocation can recover on touch', async ({
  page,
}) => {
  await mockWakeLock(page);
  await login(page);
  await expect.poll(() => activeLocks(page)).toBe(1);
  await page.evaluate(() => window.wakeLockProbe.visibility('hidden'));
  await expect.poll(() => activeLocks(page)).toBe(0);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect(await requests(page)).toHaveLength(1);
  await page.evaluate(() => window.wakeLockProbe.visibility('visible'));
  await expect.poll(() => activeLocks(page)).toBe(1);
  expect(await requests(page)).toHaveLength(2);

  await page.evaluate(() => window.wakeLockProbe.releaseFromSystem());
  await expect(page.locator('.screen-awake')).toContainText(
    'No se pudo mantener la pantalla encendida.',
  );
  await page.getByText('¿Cómo se lee?', { exact: true }).click();
  await expect(page.locator('.screen-awake')).toContainText(
    'Pantalla encendida durante el entrenamiento',
  );
  expect(await activeLocks(page)).toBe(1);
  expect(await requests(page)).toHaveLength(3);
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })),
  );
  await expect.poll(() => activeLocks(page)).toBe(0);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect(await requests(page)).toHaveLength(3);
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
  );
  await expect.poll(() => activeLocks(page)).toBe(1);
  expect(await requests(page)).toHaveLength(4);
});

test('slow lock acquisition releases immediately if training unmounts or the page hides before it resolves', async ({
  page,
}) => {
  await mockWakeLock(page, { deny: false, defer: true });
  await login(page);
  await expect.poll(() => requests(page)).toHaveLength(1);
  await page.getByRole('button', { name: 'Mi historial', exact: true }).click();
  await page.evaluate(() => window.wakeLockProbe.finishNext());
  await expect.poll(() => page.evaluate(() => window.wakeLockProbe.releases)).toBe(1);
  expect(await activeLocks(page)).toBe(0);

  await page.getByRole('button', { name: 'Entrenamiento', exact: true }).click();
  await expect.poll(() => requests(page)).toHaveLength(2);
  await page.evaluate(() => {
    window.wakeLockProbe.visibility('hidden');
    window.wakeLockProbe.finishNext();
  });
  await expect.poll(() => page.evaluate(() => window.wakeLockProbe.releases)).toBe(2);
  expect(await activeLocks(page)).toBe(0);
  await page.evaluate(() => window.wakeLockProbe.visibility('visible'));
  await expect.poll(() => requests(page)).toHaveLength(3);
  await page.evaluate(() => window.wakeLockProbe.finishNext());
  await expect.poll(() => activeLocks(page)).toBe(1);
});

test('a pending hidden-page rejection retries after returning, without duplicate active locks', async ({
  page,
}) => {
  await mockWakeLock(page, { deny: false, defer: true });
  await login(page);
  await expect.poll(() => requests(page)).toHaveLength(1);
  await page.evaluate(() => {
    window.wakeLockProbe.visibility('hidden');
    window.wakeLockProbe.visibility('visible');
    window.wakeLockProbe.deny = true;
    window.wakeLockProbe.finishNext();
  });
  await expect.poll(() => requests(page)).toHaveLength(2);
  await page.evaluate(() => {
    window.wakeLockProbe.deny = false;
    window.wakeLockProbe.finishNext();
  });
  await expect.poll(() => activeLocks(page)).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect(await requests(page)).toHaveLength(2);
});

test('denied requests do not spin or break timing, and the retry button recovers when allowed', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mockWakeLock(page, { deny: true, defer: false });
  await login(page);
  await expect(page.locator('.screen-awake')).toContainText(
    'No se pudo mantener la pantalla encendida.',
  );
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.clock.fastForward(180000);
  expect(await requests(page)).toHaveLength(1);
  await page.locator('h1').click();
  await page.keyboard.down('Space');
  await page.clock.runFor(400);
  await page.keyboard.up('Space');
  await expect(page.getByRole('button', { name: /^Cronómetro: mantén/ })).toContainText(
    'A TU RITMO',
  );
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    window.wakeLockProbe.deny = false;
  });
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect.poll(() => activeLocks(page)).toBe(1);
  await expect(page.locator('.screen-awake')).toContainText(
    'Pantalla encendida durante el entrenamiento',
  );
  expect(errors).toEqual([]);
});

test('browsers without wake lock explain the limitation and manual training still works', async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: undefined }),
  );
  await login(page);
  await expect(page.locator('.screen-awake')).toContainText(
    'abre Cube por HTTPS con un navegador compatible',
  );
  await page.getByRole('button', { name: 'A mano', exact: true }).click();
  await page.getByLabel('Tu tiempo, con tu cronómetro').fill('15.01');
  await page.getByRole('button', { name: 'Guardar tiempo', exact: true }).click();
  await expect(page.locator('.timer-footer')).toContainText('15.01 guardado en privado');
});

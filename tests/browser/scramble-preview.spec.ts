import { expect, test, type Locator, type Page } from '@playwright/test';
import { puzzles } from 'cubing/puzzles';
import { EVENTS } from '../../shared/domain.js';
import type { EventId } from '../../src/types';

async function login(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar a entrenar', exact: true }).click();
  await page.getByLabel('Tu contraseña', { exact: true }).fill('a');
  await page.getByRole('dialog').getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hora de resolver.' })).toBeVisible();
  await expect(page.getByLabel('Mezcla actual')).not.toBeEmpty();
}

// Independent oracle: derive each expected sticker from the puzzle's cubie state and
// solved SVG, rather than trusting the component's metadata or its SVG animator.
async function expectedColors(event: EventId, alg: string) {
  const loader = puzzles[EVENTS[event].puzzle];
  const [kpuzzle, source] = await Promise.all([loader.kpuzzle(), loader.svg()]);
  const solved = new Map(
    [...source.matchAll(/<use\s+id="(\w+)-l(\d+)-o(\d+)"[^>]*?style="fill:\s*([^";]+)[^>]*>/g)].map(
      (match) => [`${match[1]}-l${match[2]}-o${match[3]}`, match[4].trim()],
    ),
  );
  const pattern = kpuzzle.defaultPattern().applyAlg(alg);
  return Object.fromEntries(
    [...solved.keys()].map((id) => {
      const [, orbitName, slotText, orientationText] = id.match(/^(\w+)-l(\d+)-o(\d+)$/)!;
      const slot = Number(slotText),
        orientation = Number(orientationText);
      const orbit = pattern.patternData[orbitName];
      const modulus = kpuzzle.definition.orbits.find(
        (item) => item.orbitName === orbitName,
      )!.numOrientations;
      const sourceOrientation = (orientation - orbit.orientation[slot] + modulus) % modulus;
      return [id, solved.get(`${orbitName}-l${orbit.pieces[slot]}-o${sourceOrientation}`)];
    }),
  );
}

async function actualColors(picture: Locator) {
  const colors = await picture.locator('svg').evaluate((svg) =>
    Object.fromEntries(
      [...svg.querySelectorAll<SVGElement>('use[id]')].map((sticker) => {
        const reference = sticker.style.fill.match(/#([^"')]+)/)?.[1];
        const color = svg.querySelector(`[id="${reference}"] > stop`)?.getAttribute('stop-color');
        return [sticker.id, color];
      }),
    ),
  );
  return Object.fromEntries(
    Object.entries(colors).map(([id, color]) => [id, color?.replace('rgb(34, 102, 255)', '#26f')]),
  );
}

async function expectPicture(picture: Locator, event: EventId, alg: string) {
  await expect(picture).toHaveAttribute('data-state', 'ready');
  await expect(picture.getByRole('img')).toHaveAttribute(
    'aria-label',
    `Estado de ${EVENTS[event].name} después de aplicar la mezcla: ${alg}`,
  );
  expect(await actualColors(picture)).toEqual(await expectedColors(event, alg));
  await expect(picture.locator('[data-copy-id]')).toHaveCount(0);
}
const preview = (page: Page) => page.getByRole('region', { name: 'Dibujo de la mezcla' });

test('mobile previews show the exact cube and Pyraminx state; enlargement preserves colors and stays within the viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await login(page);
  for (const event of ['333', '222', 'pyram'] as const) {
    await page.getByRole('button', { name: EVENTS[event].name, exact: true }).click();
    const picture = preview(page).locator('.scramble-picture');
    await expect(picture).toHaveAttribute('data-event', event);
    const alg = (await page.getByLabel('Mezcla actual').textContent())!.trim();
    await expectPicture(picture, event, alg);
    const colors = await actualColors(picture);
    expect(Object.keys(colors)).toHaveLength(event === '333' ? 72 : event === '222' ? 24 : 36);
    expect(new Set(Object.values(colors)).size).toBe(event === 'pyram' ? 4 : 6);
    await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
    await preview(page).screenshot({ path: `test-results/scramble-${event}-mobile.png` });

    await page.getByRole('button', { name: 'Ampliar dibujo', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expectPicture(dialog.locator('.scramble-picture'), event, alg);
    await expectPicture(picture, event, alg); // SVG definitions remain isolated between both nets.
    await expect(dialog.locator('.alg')).toHaveText(alg);
    await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
    await dialog.screenshot({ path: `test-results/scramble-${event}-expanded-mobile.png` });
    await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Ampliar dibujo', exact: true })).toBeFocused();
  }
  expect(requests.some((url) => /twisty-dynamic-3d/.test(url))).toBe(false);
  expect(requests.every((url) => new URL(url).origin === 'http://127.0.0.1:3210')).toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 1280);
});

test('new scrambles, manual saves and undoing an accidental solve keep the drawing in sync', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('button', { name: /^2×2×2/ }).click();
  let alg = (await page.getByLabel('Mezcla actual').textContent())!.trim();
  await expectPicture(preview(page).locator('.scramble-picture'), '222', alg);
  await page.getByRole('button', { name: 'Nueva mezcla', exact: true }).click();
  await expect(page.getByLabel('Mezcla actual')).not.toHaveText(alg);
  alg = (await page.getByLabel('Mezcla actual').textContent())!.trim();
  await expectPicture(preview(page).locator('.scramble-picture'), '222', alg);
  await page.getByRole('button', { name: 'A mano', exact: true }).click();
  await page.getByLabel('Tu tiempo, con tu cronómetro').fill('12.34');
  await page.getByRole('button', { name: 'Guardar tiempo', exact: true }).click();
  await expect(page.locator('.timer-footer')).toContainText('12.34 guardado en privado');
  await expect(page.getByLabel('Mezcla actual')).not.toHaveText(alg);
  const next = (await page.getByLabel('Mezcla actual').textContent())!.trim();
  await expectPicture(preview(page).locator('.scramble-picture'), '222', next);
  await page.getByRole('button', { name: 'Borrar último tiempo', exact: true }).click();
  await page.getByRole('button', { name: 'Sí, borrar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Mezcla actual')).toHaveText(alg);
  await expectPicture(preview(page).locator('.scramble-picture'), '222', alg);
});

test('switching puzzles while the renderer loads never leaves the previous puzzle drawing', async ({
  page,
}) => {
  let unblock!: () => void;
  const blocked = new Promise<void>((resolve) => {
    unblock = resolve;
  });
  let requested!: () => void;
  const started = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route(/\/assets\/scrambleDiagram-[^/]+\.js$/, async (route) => {
    requested();
    await blocked;
    await route.continue();
  });
  try {
    await login(page);
    await started;
    await page.getByRole('button', { name: /^Pyraminx/ }).click();
    await expect(preview(page).locator('.scramble-picture')).toHaveAttribute('data-event', 'pyram');
    const alg = (await page.getByLabel('Mezcla actual').textContent())!.trim();
    unblock();
    await expectPicture(preview(page).locator('.scramble-picture'), 'pyram', alg);
    await expect(preview(page).locator('.scramble-picture svg')).toHaveCount(1);
  } finally {
    unblock();
  }
});

test('renderer download failures keep the timer and manual entry usable without a misleading diagram', async ({
  page,
}) => {
  await page.route(/\/assets\/scrambleDiagram-[^/]+\.js$/, (route) => route.abort());
  await login(page);
  await expect(preview(page)).toContainText('No se pudo dibujar esta mezcla.');
  await expect(preview(page).locator('.scramble-picture-canvas')).toBeHidden();
  await expect(preview(page).locator('.scramble-picture svg')).toHaveCount(0);
  await page.locator('h1').click();
  await page.keyboard.down('Space');
  await expect(page.getByRole('button', { name: /^Cronómetro: mantén/ })).toContainText('¡LISTO!');
  await page.keyboard.up('Space');
  await expect(page.getByRole('button', { name: /^Cronómetro: mantén/ })).toContainText(
    'A TU RITMO',
  );
  await expect(page.getByRole('button', { name: 'Ampliar dibujo', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'A mano', exact: true }).click();
  await page.getByLabel('Tu tiempo, con tu cronómetro').fill('15.01');
  await page.getByRole('button', { name: 'Guardar tiempo', exact: true }).click();
  await expect(page.locator('.timer-footer')).toContainText('15.01 guardado en privado');
});

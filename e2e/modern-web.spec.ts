import { expect, test } from '@playwright/test';
import { start } from './helpers';

declare global { interface Window { receiptPreparationWorkers: number } }

test('recipe detail prioritizes its photo and manifest retains the existing app identity', async ({ page }) => {
  await start(page, '/retete/reteta/?id=ciorba-de-perisoare');
  const photo = page.locator('img[src="/retete/ciorba-de-perisoare.webp"]');
  await expect(photo).toHaveAttribute('loading', 'eager');
  await expect(photo).toHaveAttribute('fetchpriority', 'high');
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.id).toBe('/');
  expect(new URL(manifest.id, page.url()).href).toBe(new URL(manifest.start_url, page.url()).href);
});

test('long recipe text grows vertically within a bounded field', async ({ page }) => {
  await start(page, '/retete/import/');
  await page.getByRole('radio', { name: 'Text', exact: true }).click();
  const text = page.locator('#import-text');
  await expect(text).toBeVisible();
  const initial = (await text.boundingBox())!;
  await text.fill(Array.from({ length: 100 }, (_, i) => `Pasul ${i}: pregătește ingredientele.`).join('\n'));
  const grown = (await text.boundingBox())!;
  expect(grown.height).toBeGreaterThan(initial.height);
  expect(grown.width).toBeCloseTo(initial.width, 0);
  expect(grown.height).toBeLessThanOrEqual(await page.evaluate(() => Math.max(256, innerHeight / 2)));
  expect(await text.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
});

test('sheet contains gestures without moving the page and still closes with Escape', async ({ page }) => {
  await start(page, '/cumparaturi/');
  await page.evaluate(() => { document.body.style.minHeight = '3000px'; });
  await page.getByRole('button', { name: 'Listă nouă', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Listă nouă', exact: true });
  await expect(sheet).toBeVisible();
  const scrollY = await page.evaluate(() => window.scrollY);
  expect(await sheet.evaluate(el => getComputedStyle(el).overscrollBehavior)).toBe('contain');
  expect(await sheet.evaluate(el => getComputedStyle(el, '::backdrop').overscrollBehavior)).toBe('contain');
  await page.mouse.move(5, 5);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  await page.keyboard.press('Escape');
  await expect(sheet).not.toBeVisible();
});

for (const mode of ['worker', 'fallback'] as const) test(`real offline reader works with ${mode} preparation`, async ({ page, context }) => {
  test.setTimeout(120_000);
  await page.addInitScript((mode) => {
    const OriginalWorker = window.Worker;
    window.receiptPreparationWorkers = 0;
    window.Worker = class extends OriginalWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        if (mode === 'fallback' && String(url).includes('turbopack-worker')) throw new Error('Preparation worker unavailable');
        super(url, options);
        this.addEventListener('message', event => {
          if (event.data?.blob instanceof Blob) window.receiptPreparationWorkers++;
        });
      }
    };
  }, mode);
  await start(page, '/cumparaturi/bon/');
  await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.ready).active)).toBe(true);
  await page.reload();
  // Cache the OCR model using a real read before testing the offline repeat.
  const read = async () => {
    await page.getByTestId('bon-fisier').setInputFiles('e2e/fixtures/bon-exif-rotit.jpg');
    await page.getByRole('button', { name: 'Citește bonul', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Verifică bonul' })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByLabel('Magazinul')).toHaveValue('kaufland');
    const prepared = await page.evaluate(() => window.receiptPreparationWorkers);
    if (mode === 'worker') expect(prepared).toBeGreaterThan(0);
    else expect(prepared).toBe(0);
  };
  await read();
  await context.setOffline(true);
  await page.goto('/cumparaturi/bon/');
  await read();
});

test('an install offer received on home remains available after navigating to settings', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'install', { value: undefined, configurable: true }));
  await start(page);
  await page.evaluate(() => {
    const offer = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }),
    });
    window.dispatchEvent(offer);
  });
  await page.getByRole('link', { name: 'Gospodărie și setări', exact: true }).click();
  const install = page.getByRole('button', { name: 'Instalează Cămara', exact: true });
  await expect(install).toBeVisible();
  await page.getByRole('navigation', { name: 'Navigare principală' }).getByRole('link', { name: 'Acasă', exact: true }).click();
  await page.getByRole('link', { name: 'Gospodărie și setări', exact: true }).click();
  await expect(install).toBeVisible();
  await install.click();
  await expect(install).toHaveCount(0);
});

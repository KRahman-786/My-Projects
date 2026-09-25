/**
 * Browser smoke test of the core purchase journey against a running stack (seeded database).
 *   npm run e2e            (frontend on :3000, API on :4000)
 * Env: E2E_BASE_URL, E2E_EMAIL, E2E_PASSWORD, CHROMIUM_PATH (a local Chrome/Chromium executable).
 */
import { chromium } from 'playwright-core';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const EMAIL = process.env.E2E_EMAIL ?? 'neha@example.com';
const PASSWORD = process.env.E2E_PASSWORD ?? 'Customer@123';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
let failed = false;
const step = async (name, fn) => {
  try {
    await fn();
    console.log('✓', name);
  } catch (e) {
    failed = true;
    console.log('✗', name, '—', e.message.split('\n')[0]);
    throw e;
  }
};

try {
  await step('guest adds a product to the bag', async () => {
    await page.goto(`${BASE}/products/cosmetics/intense-black-kajal`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Add to bag' }).first().click();
    await page.getByText('added to your bag').waitFor({ timeout: 8000 });
  });
  await step('checkout requires login', async () => {
    await page.goto(`${BASE}/checkout`, { waitUntil: 'networkidle' });
    if (!page.url().includes('/login')) throw new Error(`expected redirect to login, got ${page.url()}`);
  });
  await step('login returns to checkout with the guest bag merged', async () => {
    await page.getByLabel('Email').fill(EMAIL);
    await page.locator('input[name=password]').fill(PASSWORD);
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('**/checkout', { timeout: 10000 });
    await page.getByText(/Order summary \(\d+ items?\)/i).waitFor({ timeout: 8000 });
  });
  await step('address → shipping → Cash on Delivery', async () => {
    await page.getByRole('button', { name: 'Deliver here' }).click();
    await page.getByText('Arrives by').waitFor();
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await page.locator('label', { hasText: 'Pay in cash when your order arrives' }).click();
  });
  await step('place order and see confirmation', async () => {
    await page.getByRole('button', { name: /Place order/ }).click();
    await page.waitForURL('**/checkout/confirmation/**', { timeout: 15000 });
    await page.getByText('Your order is confirmed').waitFor({ timeout: 10000 });
  });
  await step('invoice downloads as PDF', async () => {
    await page.getByRole('link', { name: 'View order' }).click();
    const href = await page.getByText('Download invoice').getAttribute('href');
    const res = await page.request.get(new URL(href, BASE).toString());
    if (res.headers()['content-type'] !== 'application/pdf') throw new Error(`unexpected ${res.status()} ${res.headers()['content-type']}`);
  });
  await step('customer cancels the order', async () => {
    await page.getByRole('button', { name: 'Cancel order' }).click();
    await page.getByRole('button', { name: 'Confirm cancellation' }).click();
    await page.getByText('Your order has been cancelled').waitFor();
  });
} catch {
  /* reported above */
} finally {
  await browser.close();
  process.exit(failed ? 1 : 0);
}

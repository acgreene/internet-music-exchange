import { test, expect } from '@playwright/test';

test('has platform name heading', async ({ page }) => {
  await page.goto('/');

  expect(await page.locator('h1').innerText()).toContain(
    'Internet Music Exchange',
  );
});

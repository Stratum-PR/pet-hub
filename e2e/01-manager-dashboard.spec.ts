import { test, expect, loginAsManager, seedData } from './fixtures';

test('1. manager logs in and lands on the dashboard', async ({ page }) => {
  const s = seedData();
  await loginAsManager(page);
  await expect(page).toHaveURL(new RegExp(`/${s.slug}/dashboard$`));
  await expect(page.getByRole('heading', { level: 1, name: /Dashboard/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Maria Manager' })).toBeVisible();
  // The seeded team: the owner's staff row (from signup) plus two hourly employees.
  await expect(page.getByRole('link', { name: /Personal Activo 3/ })).toBeVisible();
});
// TEMP U24 proof (2), will be reverted

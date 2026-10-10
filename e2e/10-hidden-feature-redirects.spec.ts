import { test, expect, login, seedData } from './fixtures';

// E2E-3 (FIX_LOG): a route whose feature is hidden redirects to the dashboard. The redirect was relative to the route,
// so /<slug>/appointments went to /<slug>/appointments/dashboard, which matches nothing: a blank page.
test('10. hidden features redirect a basic-plan manager to the dashboard (E2E-3)', async ({ page }) => {
  test.setTimeout(120_000); // 8 full page loads
  const s = seedData();
  const b = s.basicManager;
  await login(page, b.email, b.pass);
  for (const path of ['appointments', 'calendar', 'appt-book', 'appt-book/calendar', 'inventory', 'payment', 'transactions', 'transactions/new']) {
    await page.goto(`/${b.slug}/${path}`);
    await expect(page, `/${path}`).toHaveURL(new RegExp(`/${b.slug}/dashboard$`));
    await expect(page.getByRole('heading', { level: 1, name: /Dashboard/ })).toBeVisible();
  }
});

test('10b. an employee opening the dashboard lands on clients', async ({ page }) => {
  const s = seedData();
  await login(page, s.employee.email, s.employee.pass);
  await page.goto(`/${s.slug}/dashboard`);
  await expect(page).toHaveURL(new RegExp(`/${s.slug}/clients$`));
  await expect(page.getByRole('heading', { level: 1, name: /Clientes/ })).toBeVisible();
});

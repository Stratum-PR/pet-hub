import { test, expect, loginAsManager, seedData } from './fixtures';

// "Cobrar" mounts a second copy of the realtime hooks (QuickChargeDialog); before the E2E-1 fix this crashed the app.
test('5. manager checks out an appointment in cash', async ({ page }) => {
  const s = seedData();
  await loginAsManager(page);
  await page.goto(`/${s.slug}/appt-book`);
  await page.getByRole('tab', { name: 'Historial' }).click();
  const row = page.getByRole('row').filter({ hasText: s.client.lastName }).filter({ hasText: '· 9 AM' });
  await row.click();
  await page.getByRole('button', { name: 'Cobrar $45.00' }).click();

  // $45.00 + PR state tax 10.5% ($4.73) + municipal 1% ($0.45) = $50.18
  const charge = page.getByRole('dialog', { name: 'Cobrar' });
  await expect(charge).toContainText(/Subtotal\s*\$45\.00/);
  await expect(charge).toContainText(/Total\s*\$50\.18/);
  await charge.getByRole('button', { name: 'Efectivo' }).click();
  await charge.getByRole('button', { name: 'Exacto' }).click();
  await charge.getByRole('button', { name: 'Cobrar $50.18' }).click();

  const paid = page.getByRole('dialog', { name: 'Pagado' });
  await expect(paid).toContainText('$50.18');
  await expect(paid).toContainText('Efectivo');
  await paid.getByRole('button', { name: 'Listo' }).click();

  // The sale is saved and the appointment is billed.
  await page.goto(`/${s.slug}/transactions`);
  const tx = page.getByRole('row').filter({ hasText: s.client.lastName });
  await expect(tx).toHaveCount(1);
  await expect(tx).toContainText('$50.18');
  await expect(tx).toContainText('Paid');
  await expect(tx).toContainText('Cash');
  await page.goto(`/${s.slug}/appt-book`);
  await page.getByRole('tab', { name: 'Historial' }).click();
  await expect(row).toContainText('Pagado');
});

test('5b. "Nueva transacción" opens (second copies of the inventory and appointments hooks, E2E-1)', async ({ page }) => {
  const s = seedData();
  await loginAsManager(page);
  await page.goto(`/${s.slug}/transactions/new`);
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar transacción' })).toBeDisabled();
  await expect(page.getByText('App failed to start')).toHaveCount(0);
});

test('5c. header "Cobrar" opens Quick charge over the dashboard (second copy of useTransactions, E2E-1)', async ({ page }) => {
  await loginAsManager(page);
  await expect(page.getByRole('heading', { level: 1, name: /Dashboard/ })).toBeVisible();
  await page.getByRole('banner').getByRole('button', { name: 'Cobrar', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Cobrar' })).toBeVisible();
  await expect(page.getByText('App failed to start')).toHaveCount(0);
});

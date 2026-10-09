import { test, expect, loginAsManager, seedData } from './fixtures';

// KNOWN ISSUE (FIX_LOG P1-07, finding E2E-1): "Cobrar" opens QuickChargeDialog, whose useInventory() opens a realtime
// channel with the same topic as Index's; supabase-js 2.117 returns the already-subscribed channel and `.on()` throws,
// so the whole app crashes ("App failed to start"). Remove test.fail() when fixed.
test('5. manager checks out an appointment in cash [known issue E2E-1]', async ({ page }) => {
  test.fail();
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

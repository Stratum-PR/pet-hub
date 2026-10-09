import { test, expect, loginAsManager, seedData } from './fixtures';

test('7. payroll page loads with the right hours and pay', async ({ page }) => {
  const s = seedData();
  await loginAsManager(page);
  await page.goto(`/${s.slug}/reports/payroll`);
  await page.getByRole('tab', { name: 'Cálculo de pagos' }).click();
  // Seeded: two closed 4 h shifts today at $12.00/h.
  const eli = page.getByRole('row').filter({ hasText: s.employee.name });
  await expect(eli).toContainText('$12.00');
  await expect(eli).toContainText(`${s.payroll.hours.toFixed(2)}`);
  await expect(eli).toContainText(`$${s.payroll.gross.toFixed(2)}`);
  // Totals equal Eli's row (the kiosk flow's seconds-long shift rounds to 0.00 h / $0.00).
  const totals = page.getByRole('row').filter({ hasText: 'TOTALS' });
  await expect(totals).toContainText(`${s.payroll.hours.toFixed(2)}`);
  await expect(totals).toContainText(`$${s.payroll.gross.toFixed(2)}`);
});

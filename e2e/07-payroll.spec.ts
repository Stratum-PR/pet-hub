import { test, expect, loginAsManager, seedData } from './fixtures';
import { pinBrowserClock } from './clock';

test('7. payroll page loads with the right hours and pay', async ({ page }) => {
  const s = seedData();
  // The seeded shifts are on the seed's day in Puerto Rico. With no saved pay-schedule anchor the page anchors the
  // period on today's UTC date, which from 20:00 PR is already tomorrow, so the shifts fall before the period. Pin the
  // browser to midday on the seed's day so the page's "today" is the shifts' day whenever CI runs.
  await pinBrowserClock(page, '12:00');
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

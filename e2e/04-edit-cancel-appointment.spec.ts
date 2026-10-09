import { localDateKey } from './seed';
import { test, expect, loginAsManager, seedData, type Page } from './fixtures';

/** Pins the browser clock to `hh:mm` today in Puerto Rico (timers keep running), so slot rules don't depend on when CI runs. */
async function browserTimeToday(page: Page, hhmm: string) {
  await page.clock.setFixedTime(new Date(`${localDateKey(0)}T${hhmm}:00-04:00`));
}

/** Opens "Editar / reprogramar" for a seeded appointment from the history list. */
async function openEditDialog(page: Page, which: 'edit' | 'inspect' | 'checkout', startLabel: string) {
  const s = seedData();
  const day = Number(s.appointments[which].date.slice(8, 10));
  await loginAsManager(page);
  await page.goto(`/${s.slug}/appt-book`);
  await page.getByRole('tab', { name: 'Historial' }).click();
  const row = page.getByRole('row').filter({ hasText: s.client.lastName }).filter({ has: page.getByRole('cell', { name: new RegExp(`^${day} \\S+ \\d{4}`) }) });
  await expect(row).toContainText(`· ${startLabel}`);
  await row.click();
  await page.getByRole('button', { name: 'Editar / reprogramar' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit Appointment' });
  // The dialog must open on the appointment's own date ("October 11th, 2026").
  const ownDate = edit.getByRole('button', { name: new RegExp(`\\b${day}(st|nd|rd|th), \\d{4}`) });
  return { row, edit, ownDate };
}

test('4. manager reschedules an appointment, then cancels it', async ({ page }) => {
  await browserTimeToday(page, '08:00');
  const { row, edit, ownDate } = await openEditDialog(page, 'edit', '2 PM');
  await expect(ownDate).toBeVisible();

  await edit.locator('#edit-appt-slot-15-00').click();
  await edit.getByRole('textbox', { name: 'Any special instructions or requests...' }).fill('Reprogramada por smoke E2E');
  await edit.getByRole('button', { name: 'Update Appointment' }).click();
  await expect(edit).toBeHidden();
  await page.reload();
  await page.getByRole('tab', { name: 'Historial' }).click();
  await expect(row).toContainText('· 3 PM');

  await row.click();
  await page.getByRole('button', { name: 'Cancelar cita' }).click();
  const confirm = page.getByRole('alertdialog');
  if (await confirm.isVisible().catch(() => false)) await confirm.getByRole('button').last().click();
  await page.reload();
  await page.getByRole('tab', { name: 'Historial' }).click();
  await expect(row).toContainText(/Cancelada/);
});

// E2E-2 (FIX_LOG): the edit dialog used to start at "now" and its auto-jump effect moved it to tomorrow when today had
// no bookable slot left, so saving silently rescheduled the appointment.
test('4b. in the evening, the edit dialog opens on the appointment date (E2E-2)', async ({ page }) => {
  await browserTimeToday(page, '20:00');
  const { row, edit, ownDate } = await openEditDialog(page, 'inspect', '2 PM');
  await expect(ownDate).toBeVisible({ timeout: 5_000 });
  await expect(edit.locator('#edit-appt-slot-14-00')).toHaveClass(/bg-primary/);

  // Saving a notes-only change keeps the appointment where it was.
  await edit.getByRole('textbox', { name: 'Any special instructions or requests...' }).fill('Solo notas (E2E-2)');
  await edit.getByRole('button', { name: 'Update Appointment' }).click();
  await expect(edit).toBeHidden();
  await page.reload();
  await page.getByRole('tab', { name: 'Historial' }).click();
  await expect(row).toContainText('· 2 PM');
});

test('4c. an appointment earlier today stays on today in the edit dialog (E2E-2)', async ({ page }) => {
  await browserTimeToday(page, '20:00');
  const { ownDate } = await openEditDialog(page, 'checkout', '9 AM');
  await expect(ownDate).toBeVisible({ timeout: 5_000 });
});

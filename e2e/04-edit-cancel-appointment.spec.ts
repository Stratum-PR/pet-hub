import { test, expect, loginAsManager, seedData, adminDb, type Page } from './fixtures';
import { pinBrowserClock } from './clock';

/**
 * Puts the 'edit' appointment back the way the seed wrote it (scheduled, 2 PM - 3 PM, no notes). The seed runs once per
 * run (global-setup), not per attempt, so a retry of flow 4 would otherwise start from what the failed attempt left
 * behind (already moved to 3 PM, maybe already canceled).
 */
async function resetEditAppointment() {
  const a = seedData().appointments.edit;
  const { error } = await adminDb()
    .from('appointments')
    .update({
      status: 'scheduled',
      appointment_date: a.date,
      start_time: '14:00:00',
      end_time: '15:00:00',
      scheduled_date: `${a.date}T14:00:00-04:00`,
      notes: null,
    })
    .eq('id', a.id);
  if (error) throw new Error(`reset 'edit' appointment: ${error.message}`);
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
  await resetEditAppointment();
  await pinBrowserClock(page, '08:00');
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
  // The confirmation always opens; wait for it instead of racing its open animation.
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button').last().click();
  await expect(confirm).toBeHidden();
  // The status write and the client notice finish before this toast shows; reloading earlier can abort the write.
  await expect(page.getByText(/^Cita cancelada/)).toBeVisible();
  await page.reload();
  await page.getByRole('tab', { name: 'Historial' }).click();
  await expect(row).toContainText(/Cancelada/);
});

// E2E-2 (FIX_LOG): the edit dialog used to start at "now" and its auto-jump effect moved it to tomorrow when today had
// no bookable slot left, so saving silently rescheduled the appointment.
test('4b. in the evening, the edit dialog opens on the appointment date (E2E-2)', async ({ page }) => {
  await pinBrowserClock(page, '20:00');
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
  await pinBrowserClock(page, '20:00');
  const { ownDate } = await openEditDialog(page, 'checkout', '9 AM');
  await expect(ownDate).toBeVisible({ timeout: 5_000 });
});

// TEMP DIAGNOSTICS (U17): does a slow feature_rollout response bounce a hard load of appt-book to the dashboard?
test('4z. TEMP diag: appt-book hard load with slow feature rules', async ({ page }) => {
  const s = seedData();
  await loginAsManager(page);
  await page.route('**/rest/v1/feature_*', async (route) => {
    await new Promise((r) => setTimeout(r, 3_000));
    await route.continue();
  });
  const seen: string[] = [];
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) seen.push(f.url()); });
  await page.goto(`/${s.slug}/appt-book/list`);
  await page.waitForTimeout(8_000);
  const tab = await page.getByRole('tab', { name: 'Historial' }).count();
  console.log(`[U17-diag-4z] final=${page.url()} historialTabs=${tab} navs=${JSON.stringify(seen)}`);
});

// TEMP DIAGNOSTICS (U17): print where a failed flow 4 ended up. Removed before hand-off.
test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus) return;
  const snap = await page.locator('body').ariaSnapshot({ timeout: 5_000 }).catch((e) => `ariaSnapshot failed: ${e}`);
  console.log(`[U17-diag] url=${page.url()}\n${snap.slice(0, 6000)}`);
});

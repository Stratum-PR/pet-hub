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

// U15 DIAGNOSTIC (temporary, to be reverted): how often a hard load of the appointment book bounces a manager to /portal.
test('4y. U15 diag: 25 hard loads of appt-book', async ({ page }) => {
  test.setTimeout(240_000);
  const s = seedData();
  await loginAsManager(page);
  let t0 = Date.now();
  let events: string[] = [];
  const key = (u: string) =>
    /\/rest\/v1\/profiles\?/.test(u) ? 'profiles' : /\/rest\/v1\/business_client_links\?/.test(u) ? 'client_link' : /\/rest\/v1\/businesses\?.*[&?]slug=eq/.test(u) ? 'biz_by_slug' : '';
  page.on('request', (r) => { const k = key(r.url()); if (k) events.push(`${Date.now() - t0}ms start ${k}`); });
  page.on('requestfinished', (r) => { const k = key(r.url()); if (k) events.push(`${Date.now() - t0}ms done ${k}`); });
  page.on('requestfailed', (r) => { const k = key(r.url()); if (k) events.push(`${Date.now() - t0}ms FAILED ${k} ${r.failure()?.errorText}`); });
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) events.push(`${Date.now() - t0}ms nav ${new URL(f.url()).pathname}`); });
  let bounced = 0;
  for (let i = 1; i <= 25; i++) {
    events = [];
    t0 = Date.now();
    await page.goto(`/${s.slug}/appt-book/appointments`);
    const tab = page.getByRole('tab', { name: 'Historial' });
    const outcome = await Promise.race([
      tab.waitFor({ state: 'visible', timeout: 15_000 }).then(() => 'ok', () => 'timeout'),
      page.waitForURL(/\/portal/, { timeout: 15_000 }).then(() => 'portal', () => 'timeout'),
    ]);
    const firstProfiles = events.filter((e) => /profiles/.test(e)).slice(0, 2).join(', ');
    const firstLink = events.filter((e) => /client_link|biz_by_slug/.test(e)).slice(0, 4).join(', ');
    console.log(`[U15-DIAG] 4y #${i}: ${outcome}; slug lookups=${events.filter((e) => /start biz_by_slug/.test(e)).length}; profiles: ${firstProfiles}; link: ${firstLink}`);
    if (outcome !== 'ok') { bounced++; for (const e of events.slice(0, 60)) console.log(`[U15-DIAG]     ${e}`); }
  }
  console.log(`[U15-DIAG] 4y: ${bounced}/25 hard loads did not show the appointment book`);
});

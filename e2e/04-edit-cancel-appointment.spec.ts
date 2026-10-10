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


// U15 DIAGNOSTIC (temporary, to be reverted): record what the page does around the reloads.
const diagLog: string[] = [];
function diagAttach(page: Page) {
  const t0 = Date.now();
  const ts = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`;
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') diagLog.push(`${ts()} console.${m.type()}: ${m.text().slice(0, 400)}`); });
  page.on('pageerror', (e) => diagLog.push(`${ts()} pageerror: ${String(e).slice(0, 400)}`));
  page.on('request', (r) => { if (/\/rest\/v1\/(profiles|businesses|business_client_links|rpc)|\/auth\/v1\//.test(r.url())) diagLog.push(`${ts()} start ${r.method()} ${r.url().slice(0, 220)}`); });
  page.on('requestfailed', (r) => diagLog.push(`${ts()} requestfailed: ${r.method()} ${r.url().slice(0, 200)} ${r.failure()?.errorText}`));
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) diagLog.push(`${ts()} navigated: ${f.url()}`); });
  page.on('response', async (r) => {
    const u = r.url();
    if (r.status() >= 400 || /\/rest\/v1\/(appointments|rpc|profiles|businesses|business_client_links|feature_)|\/auth\/v1\//.test(u)) {
      let body = '';
      if (r.status() >= 400) body = (await r.text().catch(() => '')).slice(0, 300);
      diagLog.push(`${ts()} ${r.status()} ${r.request().method()} ${u.slice(0, 220)} ${body}`);
    }
  });
}
async function diagAfterReload(page: Page, label: string) {
  const tab = page.getByRole('tab', { name: 'Historial' });
  const ok = await tab.waitFor({ state: 'visible', timeout: 20_000 }).then(() => true, () => false);
  if (ok) {
    console.log(`[U15-DIAG] ${label}: tab visible, url=${page.url()}`);
    for (const l of diagLog.filter((x) => /profiles|business_client_links|businesses|navigated|PATCH/.test(x)).slice(-40)) console.log(`[U15-DIAG]   ${l}`);
    diagLog.length = 0;
    return;
  }
  console.log(`[U15-DIAG] ${label}: tab NOT visible after 20s; url=${page.url()}`);
  for (const l of diagLog.slice(-120)) console.log(`[U15-DIAG]   ${l}`);
  const text = await page.locator('body').innerText().catch((e) => `innerText failed: ${e}`);
  console.log(`[U15-DIAG] body text: ${text.replace(/\s+/g, ' ').slice(0, 1500)}`);
  const ls = await page.evaluate(() => Object.keys(localStorage).map((k) => `${k}(${(localStorage.getItem(k) ?? '').length})`)).catch(() => []);
  console.log(`[U15-DIAG] localStorage: ${ls.join(' | ')}`);
  const now = await page.evaluate(() => new Date().toISOString()).catch(() => '?');
  console.log(`[U15-DIAG] browser now=${now} real now=${new Date().toISOString()}`);
}

test('4. manager reschedules an appointment, then cancels it', async ({ page }) => {
  await resetEditAppointment();
  diagAttach(page);
  await pinBrowserClock(page, '08:00');
  const { row, edit, ownDate } = await openEditDialog(page, 'edit', '2 PM');
  await expect(ownDate).toBeVisible();

  await edit.locator('#edit-appt-slot-15-00').click();
  await edit.getByRole('textbox', { name: 'Any special instructions or requests...' }).fill('Reprogramada por smoke E2E');
  await edit.getByRole('button', { name: 'Update Appointment' }).click();
  await expect(edit).toBeHidden();
  await page.reload();
  await diagAfterReload(page, 'after reschedule');
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
  await diagAfterReload(page, 'after cancel');
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

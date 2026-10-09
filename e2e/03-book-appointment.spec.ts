import { test, expect, loginAsManager, pickWeekStripDay, seedData } from './fixtures';

test('3. manager books an appointment for an existing client', async ({ page }) => {
  const s = seedData();
  await loginAsManager(page);
  await page.goto(`/${s.slug}/appt-book`);
  await page.getByRole('button', { name: 'Nueva cita' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nueva cita' });

  await dialog.getByRole('textbox', { name: 'Buscar por nombre o teléfono' }).fill(s.client.lastName);
  await dialog.getByRole('button', { name: new RegExp(`Carla ${s.client.lastName}`) }).click();
  await expect(dialog.getByRole('button', { name: new RegExp(`${s.pet.name} · Poodle`) })).toBeVisible();
  await dialog.getByRole('button', { name: new RegExp(s.service.name) }).click();
  await dialog.getByRole('button', { name: 'Eli E.' }).click();
  await pickWeekStripDay(dialog, 1);
  await dialog.getByRole('button', { name: '11 AM', exact: true }).click();
  await expect(dialog).toContainText(/Total\s*\$45\.00/);
  await dialog.getByRole('button', { name: 'Reservar' }).click();
  await expect(dialog).toBeHidden();

  // The calendar jumps to the booked day and shows the appointment; the history list has it after a reload.
  await expect(page.getByRole('button', { name: `${s.pet.name} ${s.service.name} Carla ${s.client.lastName} 11 AM – 12 PM` })).toBeVisible();
  await page.goto(`/${s.slug}/appt-book`);
  await page.getByRole('tab', { name: 'Historial' }).click();
  await expect(page.getByRole('row').filter({ hasText: s.client.lastName }).filter({ hasText: '· 11 AM' })).toContainText('Eli E.');
});

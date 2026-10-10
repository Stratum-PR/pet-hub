import { test, expect, adminDb, loginAsManager, seedData } from './fixtures';

test('6. employee clocks in and out at the time kiosk', async ({ page }) => {
  const s = seedData();
  const k = s.kioskEmployee;
  await loginAsManager(page);
  await page.goto(`/${s.slug}/time-kiosk`);
  await expect(page.getByRole('heading', { name: 'Ponchador' })).toBeVisible();
  for (const d of k.pin) await page.getByRole('button', { name: d, exact: true }).click();
  await expect(page.getByText(`Bienvenido, ${k.name}`)).toBeVisible();
  await page.getByRole('button', { name: 'Entrar' }).click();
  // No shift is scheduled, so the kiosk warns first; the punch still counts.
  await expect(page.getByRole('heading', { name: 'Fuera del turno programado' })).toBeVisible();
  await page.getByRole('button', { name: 'Ponchar' }).click();
  await expect(page.getByText(`¡${k.name} entró exitosamente!`)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Ingresa tu PIN de 4 dígitos' })).toBeVisible({ timeout: 20_000 });

  // Same PIN again: the kiosk shows the open shift and offers clock-out.
  for (const d of k.pin) await page.getByRole('button', { name: d, exact: true }).click();
  await expect(page.getByText('Registrado desde')).toBeVisible();
  await page.getByRole('button', { name: 'Salir' }).click();
  const confirmOut = page.getByRole('button', { name: 'Ponchar' });
  if (await confirmOut.isVisible({ timeout: 2_000 }).catch(() => false)) await confirmOut.click();
  await expect(page.getByText(new RegExp(`${k.name} salió`))).toBeVisible();

  // One closed shift was saved for this employee.
  const { data, error } = await adminDb().from('time_entries').select('clock_in, clock_out').eq('staff_id', k.staffId);
  expect(error).toBeNull();
  expect(data).toHaveLength(1);
  expect(data?.[0].clock_out).not.toBeNull();
});

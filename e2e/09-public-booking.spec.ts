import { test, expect, login, pickDay, seedData } from './fixtures';

test('9. public booking page sends a request that reaches the business', async ({ page }) => {
  const s = seedData();
  const petName = `Rex${s.run}`;
  await page.goto(`/${s.slug}/reservar`);
  await expect(page.getByRole('heading', { level: 1, name: s.businessName })).toBeVisible();

  await page.getByRole('button', { name: new RegExp(s.service.name) }).click();
  await page.getByRole('button', { name: 'Próximo groomer disponible' }).click();
  await pickDay(page, 2);
  await page.getByRole('button', { name: '10 AM', exact: true }).click();

  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Nora');
  await page.getByRole('textbox', { name: 'Apellido' }).fill(`Nueva${s.run}`);
  await page.getByRole('textbox', { name: 'Teléfono' }).fill('7875550199');
  await page.getByRole('textbox', { name: 'Correo electrónico' }).fill(`nora-${s.run}@grumi.test`);
  await page.getByRole('textbox', { name: 'Nombre de la mascota' }).fill(petName);
  await expect(page.getByText('$45.00 · 60 min')).toBeVisible();
  await page.getByRole('button', { name: 'Enviar solicitud' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Solicitud enviada' })).toBeVisible();
  await expect(page.getByText(/recibió tu solicitud para .* · 10 AM/)).toBeVisible();

  // The business sees it as an online request.
  await login(page, s.manager.email, s.manager.pass);
  await page.goto(`/${s.slug}/appt-book`);
  await page.getByRole('tab', { name: 'Solicitudes en línea' }).click();
  await expect(page.getByRole('tab', { name: 'Solicitudes en línea 1' })).toBeVisible();
  const request = page.getByRole('main');
  await expect(request).toContainText(`${petName}`);
  await expect(request).toContainText(`Nora Nueva${s.run}`);
  await expect(request).toContainText(/10 AM/);
  await expect(request).toContainText(/Estimado\s*\$45\.00/);
});

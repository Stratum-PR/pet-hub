import { test, expect, loginAsManager, seedData } from './fixtures';

test('2. manager creates a client and adds a pet', async ({ page }) => {
  const s = seedData();
  const last = `Nuevo${s.run}`;
  const petName = `Kiko${s.run}`;
  await loginAsManager(page);
  await page.goto(`/${s.slug}/clients`);

  await page.getByRole('button', { name: 'Agregar Cliente' }).click();
  await page.getByRole('textbox', { name: 'Nombre *' }).fill('Diego');
  await page.getByRole('textbox', { name: 'Apellido *' }).fill(last);
  await page.getByRole('textbox', { name: 'Correo Electrónico' }).fill(`diego-${s.run}@grumi.test`);
  await page.getByRole('textbox', { name: 'Teléfono *' }).fill('7875550111');
  await page.getByRole('button', { name: 'Agregar Cliente' }).last().click();

  const card = page.getByRole('button', { name: new RegExp(`Diego ${last}`) });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Agregar mascota' }).click();

  await expect(page.getByRole('heading', { name: 'Agregar Nueva Mascota' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Nombre de la Mascota *' }).fill(petName);
  await page.getByRole('combobox').filter({ hasText: 'Seleccionar especie' }).click();
  await page.getByRole('option', { name: 'Perro' }).click();
  await page.getByRole('combobox').filter({ hasText: /Seleccionar raza|raza/i }).click();
  await page.getByRole('option', { name: 'Poodle' }).click();
  await page.getByRole('button', { name: 'Agregar Mascota', exact: true }).click();

  // The pet shows on the owner's card, and survives a reload (it was saved, not just kept in state).
  await expect(card.getByRole('button', { name: petName })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: new RegExp(`Diego ${last}`) }).getByRole('button', { name: petName })).toBeVisible();
});

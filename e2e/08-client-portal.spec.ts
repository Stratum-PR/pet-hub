import { test, expect, login, seedData } from './fixtures';

// The portal has no booking action today (booking_source 'portal' is reserved but unused); clients book through
// /:slug/reservar (flow 9). This flow covers what the portal does: a client sees their own pet and appointments.
test('8. client portal shows the signed-in client their own pet and appointment', async ({ page }) => {
  const s = seedData();
  const p = s.portalClient;
  await login(page, p.email, p.pass);
  await expect(page).toHaveURL(/\/portal/);
  await page.goto(`/portal?business=${s.slug}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Portal de clientes' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Nombre *' })).toHaveValue(p.firstName);
  await expect(page.getByRole('button', { name: p.petName })).toBeVisible();
  // Listed raw today ("2026-10-13 10:00:00 · scheduled"; FIX_LOG P1-07 finding E2E-5).
  const a = s.appointments.portal;
  await expect(page.getByText(`${a.date} ${a.start}:00`)).toBeVisible();
  // Another client's pet never shows up.
  await expect(page.getByText(s.pet.name)).toHaveCount(0);
});

// P2-07 (FIX_LOG): the client sign-up must not write `profiles.role` from the browser.
// The server sets it: `handle_new_user` (trigger on auth.users) creates every profile, with role 'client' for a
// plain client sign-up, and the P0-01 trigger `profiles_lock_identity_columns` rejects any API change to it.
// This drives the real client form against a fake Supabase client that records every write.
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => {
  type Write = { table: string; op: 'insert' | 'update' | 'upsert'; payload: unknown };
  const writes: Write[] = [];
  const signUps: unknown[] = [];
  const user = { id: 'user-1', email: 'ana@grumi.test' };

  /** Any query chain resolves to `result`; insert/update/upsert payloads are recorded. */
  const query = (table: string, result: unknown = { data: null, error: null }): unknown =>
    new Proxy(() => {}, {
      get: (_t, prop) => {
        if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(result);
        if (prop === 'insert' || prop === 'update' || prop === 'upsert') {
          return (payload: unknown) => {
            writes.push({ table, op: prop, payload });
            return query(table, { data: { id: 'client-1' }, error: null });
          };
        }
        return () => query(table, result);
      },
    });

  const supabase = {
    from: (table: string) => query(table, { data: table === 'breeds' ? [] : null, error: null }),
    rpc: () => query('rpc'),
    auth: {
      signUp: (args: unknown) => {
        signUps.push(args);
        return Promise.resolve({ data: { user, session: { user } }, error: null });
      },
    },
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
  };
  return { supabase, writes, signUps };
});

vi.mock('@/integrations/supabase/client', () => ({ supabase: fake.supabase }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ refreshAuth: () => Promise.resolve() }) }));
vi.mock('@/hooks/useThemedGrumiWordmarkSrc', () => ({ useThemedGrumiWordmarkSrc: () => '/logo.svg' }));
vi.mock('@/components/LanguageSwitcher', () => ({ LanguageSwitcher: () => null }));
vi.mock('@/components/Footer', () => ({ Footer: () => null }));
vi.mock('@/components/PageMeta', () => ({ PageMeta: () => null }));

const { Register } = await import('./Register');

/** Recursively collects every key of a payload (objects and arrays of objects). */
function keysOf(payload: unknown): string[] {
  if (Array.isArray(payload)) return payload.flatMap(keysOf);
  if (payload && typeof payload === 'object') {
    return Object.entries(payload).flatMap(([k, v]) => [k, ...keysOf(v)]);
  }
  return [];
}

describe('Register: client sign-up', () => {
  it('lets the server set the role: no browser write or sign-up metadata carries `role`', async () => {
    const { container, getAllByRole } = render(
      <MemoryRouter initialEntries={['/registrarse']}>
        <Register />
      </MemoryRouter>,
    );
    const el = <T extends Element>(selector: string) => {
      const found = container.querySelector<T>(selector);
      if (!found) throw new Error(`missing ${selector}`);
      return found;
    };

    // Choose "client" (the third account-type button).
    fireEvent.click(getAllByRole('button')[2]);
    fireEvent.change(el('#client-email'), { target: { value: 'ana@grumi.test' } });
    fireEvent.change(el('#client-password'), { target: { value: 'Secret#123' } });
    // Step 1 → 2 → 3, then submit, as a person would.
    fireEvent.click(el<HTMLButtonElement>('form button[type="button"]'));
    fireEvent.change(el('#client-fullName'), { target: { value: 'Ana Rivera' } });
    const next = Array.from(container.querySelectorAll<HTMLButtonElement>('form button[type="button"]')).at(-1)!;
    fireEvent.click(next);
    await act(async () => {
      fireEvent.submit(el('form'));
    });

    await waitFor(() => expect(fake.writes.some((w) => w.table === 'clients')).toBe(true));
    expect(fake.signUps).toHaveLength(1);

    // The profile still gets the name the person typed.
    const profileWrites = fake.writes.filter((w) => w.table === 'profiles');
    expect(profileWrites).toEqual([{ table: 'profiles', op: 'update', payload: { full_name: 'Ana Rivera' } }]);

    // Nothing the browser sends may carry a role.
    for (const w of fake.writes) expect(keysOf(w.payload), `${w.op} ${w.table}`).not.toContain('role');
    expect(keysOf(fake.signUps)).not.toContain('role');
  });
});

// U27 (FIX_LOG): the client form's `<form onSubmit>` spans all three steps, so pressing Enter in a field on
// step 1 or 2 (the browser's implicit submission, which fires the form's `submit` event) used to run the
// whole sign-up early: no name, no pets. Enter on a non-final step must advance one step instead, with the
// same checks as that step's "Next" button; Enter on step 3 still submits. jsdom does not implement implicit
// submission, so each test presses Enter in a field and then fires the `submit` event the browser would fire.
describe('Register: client sign-up, Enter key', () => {
  function startClientSignup() {
    const { container, getAllByRole } = render(
      <MemoryRouter initialEntries={['/registrarse']}>
        <Register />
      </MemoryRouter>,
    );
    const el = <T extends Element>(selector: string) => {
      const found = container.querySelector<T>(selector);
      if (!found) throw new Error(`missing ${selector}`);
      return found;
    };
    const has = (selector: string) => container.querySelector(selector) !== null;
    /** Presses Enter in `selector`'s field and fires the submit event a browser's implicit submission sends. */
    const pressEnterIn = async (selector: string) => {
      fireEvent.keyDown(el(selector), { key: 'Enter', code: 'Enter' });
      await act(async () => {
        fireEvent.submit(el('form'));
      });
    };
    // Choose "client" (the third account-type button).
    fireEvent.click(getAllByRole('button')[2]);
    return { el, has, pressEnterIn };
  }

  it('Enter on step 1 advances to step 2 and does not sign up', async () => {
    const signUpsBefore = fake.signUps.length;
    const { el, has, pressEnterIn } = startClientSignup();
    fireEvent.change(el('#client-email'), { target: { value: 'ana@grumi.test' } });
    fireEvent.change(el('#client-password'), { target: { value: 'Secret#123' } });

    await pressEnterIn('#client-password');

    expect(fake.signUps).toHaveLength(signUpsBefore);
    expect(has('#client-fullName')).toBe(true);
    expect(has('#client-email')).toBe(false);
  });

  it('Enter on step 1 with an empty field stays on step 1 (same check as "Next")', async () => {
    const signUpsBefore = fake.signUps.length;
    const { el, has, pressEnterIn } = startClientSignup();
    fireEvent.change(el('#client-email'), { target: { value: 'ana@grumi.test' } });

    await pressEnterIn('#client-email');

    expect(fake.signUps).toHaveLength(signUpsBefore);
    expect(has('#client-email')).toBe(true);
    expect(has('#client-fullName')).toBe(false);
  });

  it('Enter on step 2 stays put without a name, advances to step 3 with one, and never signs up', async () => {
    const signUpsBefore = fake.signUps.length;
    const { el, has, pressEnterIn } = startClientSignup();
    fireEvent.change(el('#client-email'), { target: { value: 'ana@grumi.test' } });
    fireEvent.change(el('#client-password'), { target: { value: 'Secret#123' } });
    await pressEnterIn('#client-password');

    await pressEnterIn('#client-phone');
    expect(fake.signUps).toHaveLength(signUpsBefore);
    expect(has('#client-fullName')).toBe(true);

    fireEvent.change(el('#client-fullName'), { target: { value: 'Ana Rivera' } });
    await pressEnterIn('#client-fullName');
    expect(fake.signUps).toHaveLength(signUpsBefore);
    expect(has('#client-fullName')).toBe(false);
    expect(has('form button[type="submit"]')).toBe(true);
  });

  it('Enter on step 3 still submits the sign-up', async () => {
    const signUpsBefore = fake.signUps.length;
    const { el, pressEnterIn } = startClientSignup();
    fireEvent.change(el('#client-email'), { target: { value: 'ana@grumi.test' } });
    fireEvent.change(el('#client-password'), { target: { value: 'Secret#123' } });
    fireEvent.click(el<HTMLButtonElement>('form button[type="button"]'));
    fireEvent.change(el('#client-fullName'), { target: { value: 'Ana Rivera' } });
    fireEvent.click(Array.from(document.querySelectorAll<HTMLButtonElement>('form button[type="button"]')).at(-1)!);
    // Step 3: confirm the pet kinds, name the pet, press Enter in the pet's name.
    const confirm = Array.from(document.querySelectorAll<HTMLButtonElement>('form button')).find(
      (b) => b.textContent?.trim() === 'confirm and continue',
    )!;
    fireEvent.click(confirm);
    fireEvent.change(el('input[placeholder="Nombre de mascota"]'), { target: { value: 'Luna' } });

    await pressEnterIn('input[placeholder="Nombre de mascota"]');

    await waitFor(() => expect(fake.signUps).toHaveLength(signUpsBefore + 1));
  });
});

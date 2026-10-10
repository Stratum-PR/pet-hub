// U22 (FIX_LOG): ProtectedRoute's client-link check must wait until the profile is known.
// On reload the auth context has the user before the profile; the check treated the not-yet-loaded
// profile as "no business", so a manager whose profile arrived after the lookup finished was sent
// to /portal ("Cuenta de personal / Esta sesión no es de cliente").
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type FakeAuth = {
  user: { id: string } | null;
  profile: { id: string; business_id: string | null; role: string } | null;
  loading: boolean;
  isAdmin: boolean;
  business: null;
  inPlaceLoginRequired: boolean;
  clearInPlaceLoginRequirement: () => void;
};

const fake = vi.hoisted(() => ({
  auth: null as unknown as FakeAuth,
  session: null as { user: { id: string } } | null,
  fetchBusinessByPublicSlug: vi.fn(),
  getBusinessClientLink: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => fake.auth }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession: () => Promise.resolve({ data: { session: fake.session }, error: null }) } },
}));
vi.mock('@/lib/businessSlug', () => ({
  fetchBusinessByPublicSlug: (...args: unknown[]) => fake.fetchBusinessByPublicSlug(...args),
}));
vi.mock('@/lib/businessClientLink', () => ({
  getBusinessClientLink: (...args: unknown[]) => fake.getBusinessClientLink(...args),
}));
vi.mock('@/lib/authRouting', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/authRouting')>()),
  setLastRoute: () => {},
}));
vi.mock('@/components/LoginForm', () => ({ LoginForm: () => <div>LOGIN FORM</div> }));

const { ProtectedRoute } = await import('./ProtectedRoute');

const USER = { id: 'user-1' };
const managerProfile = { id: 'user-1', business_id: 'biz-1', role: 'manager' };
const clientProfile = { id: 'user-1', business_id: null, role: 'client' };

function Where({ name }: { name: string }) {
  const loc = useLocation();
  return <div data-testid="where">{`${name} ${loc.pathname}${loc.search}`}</div>;
}

function tree(path: string) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<Where name="HOME" />} />
        <Route path="/portal" element={<Where name="PORTAL" />} />
        <Route path="/:businessSlug/login" element={<Where name="SLUG LOGIN" />} />
        <Route
          path="/:businessSlug/*"
          element={
            <ProtectedRoute>
              <Where name="APP" />
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

function setAuth(patch: Partial<FakeAuth>) {
  fake.auth = { ...fake.auth, ...patch };
}

/** Let pending promises (the two lookups, getSession) settle and React flush. */
async function flush() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

const where = () => screen.queryByTestId('where')?.textContent ?? null;

describe('ProtectedRoute: business-scoped client-link gate', () => {
  beforeEach(() => {
    fake.auth = {
      user: USER,
      profile: null,
      loading: false,
      isAdmin: false,
      business: null,
      inPlaceLoginRequired: false,
      clearInPlaceLoginRequirement: () => {},
    };
    fake.session = { user: USER };
    fake.fetchBusinessByPublicSlug.mockReset().mockResolvedValue({ id: 'biz-1' });
    fake.getBusinessClientLink.mockReset().mockResolvedValue(null);
  });

  it('does not send a manager to /portal when the profile arrives after the client-link lookup (reload race)', async () => {
    setAuth({ loading: true, profile: null });
    const view = render(tree('/acme/dashboard'));
    await flush();

    // Profile resolves after the (fast) lookups would have finished.
    setAuth({ loading: false, profile: managerProfile });
    view.rerender(tree('/acme/dashboard'));
    await flush();

    expect(where()).toBe('APP /acme/dashboard');
    expect(fake.getBusinessClientLink).not.toHaveBeenCalled();
  });

  it('never looks up the client link for a manager whose profile is already loaded', async () => {
    setAuth({ profile: managerProfile });
    render(tree('/acme/dashboard'));
    await flush();

    expect(where()).toBe('APP /acme/dashboard');
    expect(fake.fetchBusinessByPublicSlug).not.toHaveBeenCalled();
  });

  it('redirects a client without an approved link to /portal', async () => {
    setAuth({ loading: true, profile: null });
    const view = render(tree('/acme/dashboard'));
    await flush();
    setAuth({ loading: false, profile: clientProfile });
    view.rerender(tree('/acme/dashboard'));
    await flush();

    expect(fake.getBusinessClientLink).toHaveBeenCalledWith('user-1', 'biz-1');
    expect(where()).toBe('PORTAL /portal?business=acme');
  });

  it('redirects a client whose link is revoked to /portal', async () => {
    fake.getBusinessClientLink.mockResolvedValue({ status: 'revoked' });
    setAuth({ profile: clientProfile });
    render(tree('/acme/dashboard'));
    await flush();

    expect(where()).toBe('PORTAL /portal?business=acme');
  });

  it('redirects to /portal when the business slug does not resolve', async () => {
    fake.fetchBusinessByPublicSlug.mockResolvedValue(null);
    setAuth({ profile: clientProfile });
    render(tree('/nope/dashboard'));
    await flush();

    expect(where()).toBe('PORTAL /portal?business=nope');
  });

  it('lets a client with an approved link in', async () => {
    fake.getBusinessClientLink.mockResolvedValue({ status: 'approved' });
    setAuth({ loading: true, profile: null });
    const view = render(tree('/acme/dashboard'));
    await flush();
    setAuth({ loading: false, profile: clientProfile });
    view.rerender(tree('/acme/dashboard'));
    await flush();

    expect(where()).toBe('APP /acme/dashboard');
  });

  it('holds the page (no children) while a client link check is pending', async () => {
    fake.getBusinessClientLink.mockReturnValue(new Promise(() => {}));
    setAuth({ profile: clientProfile });
    render(tree('/acme/dashboard'));
    await flush();

    expect(where()).toBeNull();
    expect(screen.getByLabelText('Verifying access')).toBeInTheDocument();
  });

  it('keeps today\'s behavior when the profile fetch failed (loaded, still null): checks the link and redirects', async () => {
    setAuth({ loading: false, profile: null });
    render(tree('/acme/dashboard'));
    await flush();

    expect(fake.getBusinessClientLink).toHaveBeenCalledWith('user-1', 'biz-1');
    expect(where()).toBe('PORTAL /portal?business=acme');
  });

  it('sends a logged-out visitor with no session to the marketing home', async () => {
    fake.session = null;
    setAuth({ user: null, profile: null });
    render(tree('/acme/dashboard'));
    await flush();

    expect(where()).toBe('HOME /');
    expect(fake.fetchBusinessByPublicSlug).not.toHaveBeenCalled();
  });

  it('shows the in-place login when the session ended in another tab', async () => {
    fake.session = null;
    setAuth({ user: null, profile: null, inPlaceLoginRequired: true });
    render(tree('/acme/dashboard'));
    await flush();

    expect(screen.getByText('LOGIN FORM')).toBeInTheDocument();
    expect(fake.fetchBusinessByPublicSlug).not.toHaveBeenCalled();
  });

  it('never gates the public demo route', async () => {
    setAuth({ user: null, profile: null, loading: true });
    fake.session = null;
    render(tree('/demo/dashboard'));
    await flush();

    expect(where()).toBe('APP /demo/dashboard');
    expect(fake.fetchBusinessByPublicSlug).not.toHaveBeenCalled();
  });
});

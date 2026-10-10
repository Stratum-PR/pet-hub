// U19 (FIX_LOG): a gated route must not redirect to the dashboard while the feature rules are still
// loading. Index.tsx used to render <Navigate to="../dashboard"> whenever isFeatureVisible() was
// false, which on a reload / deep link is also the case before feature_rollout and
// feature_visibility_rules arrive, so a manager reloading /<slug>/appt-book/list ended on the dashboard.
import { MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FEATURE_GATE_LOAD_TIMEOUT_MS, resolveFeatureGate, useFeatureGatesKnown } from './featureGate';

describe('resolveFeatureGate', () => {
  it('waits (loader) while the rules are unknown and the feature is not visible yet', () => {
    expect(resolveFeatureGate(false, false)).toBe('loading');
  });
  it('redirects a hidden feature once the rules are known', () => {
    expect(resolveFeatureGate(false, true)).toBe('redirect');
  });
  it('renders a visible feature whether or not the rules are loaded (demo bypass is load-independent)', () => {
    expect(resolveFeatureGate(true, true)).toBe('render');
    expect(resolveFeatureGate(true, false)).toBe('render');
  });
});

describe('useFeatureGatesKnown', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is unknown until the rollout rules load', () => {
    const { result, rerender } = renderHook(({ loaded }) => useFeatureGatesKnown(loaded), {
      initialProps: { loaded: false },
    });
    expect(result.current).toBe(false);
    rerender({ loaded: true });
    expect(result.current).toBe(true);
  });

  it('stays known after a later refetch error drops rolloutLoaded (data is kept by react-query)', () => {
    const { result, rerender } = renderHook(({ loaded }) => useFeatureGatesKnown(loaded), {
      initialProps: { loaded: true },
    });
    rerender({ loaded: false });
    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(FEATURE_GATE_LOAD_TIMEOUT_MS * 2);
    });
    expect(result.current).toBe(true);
  });

  it('does not spin forever when the rules never load (query error): known after the timeout', () => {
    const { result } = renderHook(() => useFeatureGatesKnown(false));
    act(() => {
      vi.advanceTimersByTime(FEATURE_GATE_LOAD_TIMEOUT_MS - 1);
    });
    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });
});

/** Mirrors the Index.tsx wiring of a gated route such as `appt-book/*`. */
function GatedApp({ visible, rolloutLoaded }: { visible: boolean; rolloutLoaded: boolean }) {
  const known = useFeatureGatesKnown(rolloutLoaded);
  const decision = resolveFeatureGate(visible, known);
  const gated =
    decision === 'render' ? (
      <p>Appointment book</p>
    ) : decision === 'loading' ? (
      <p>Loading…</p>
    ) : (
      <Navigate to="/acme/dashboard" replace />
    );
  return (
    <Routes>
      <Route path="/acme/dashboard" element={<p>Dashboard</p>} />
      <Route path="/acme/appt-book/*" element={gated} />
    </Routes>
  );
}

function Path() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}

function renderGated(props: { visible: boolean; rolloutLoaded: boolean }) {
  const ui = (p: typeof props) => (
    <MemoryRouter initialEntries={['/acme/appt-book/list']}>
      <GatedApp {...p} />
      <Path />
    </MemoryRouter>
  );
  const view = render(ui(props));
  return { rerender: (p: typeof props) => view.rerender(ui(p)) };
}

describe('gated route on a full page load', () => {
  it('shows the loader (no redirect) while the rules load, then the page', () => {
    const { rerender } = renderGated({ visible: false, rolloutLoaded: false });
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent('/acme/appt-book/list');

    rerender({ visible: true, rolloutLoaded: true });
    expect(screen.getByText('Appointment book')).toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent('/acme/appt-book/list');
  });

  it('still redirects a hidden feature to the dashboard once the rules are loaded', () => {
    const { rerender } = renderGated({ visible: false, rolloutLoaded: false });
    rerender({ visible: false, rolloutLoaded: true });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent('/acme/dashboard');
  });
});

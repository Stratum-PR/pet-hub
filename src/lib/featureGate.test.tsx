// U19 (FIX_LOG): a gated route must not redirect to the dashboard while the feature rules are still
// loading. Index.tsx used to render <Navigate to="../dashboard"> whenever isFeatureVisible() was
// false, which on a reload / deep link is also the case before feature_rollout and
// feature_visibility_rules arrive, so a manager reloading /<slug>/appt-book/list ended on the dashboard.
// U26: the gate waits for an explicit settled signal (loaded OR error) instead of a 10 s timeout.
import { MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { type FeatureRulesStatus, featureGatesKnown, featureRulesStatus, resolveFeatureGate } from './featureGate';

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

describe('featureRulesStatus', () => {
  const pending = { status: 'pending' as const, data: undefined };
  const ok = { status: 'success' as const, data: [] };
  const failed = { status: 'error' as const, data: undefined };
  const refetchFailed = { status: 'error' as const, data: [] };

  it('is loading while either query has not settled', () => {
    expect(featureRulesStatus(pending, pending)).toBe('loading');
    expect(featureRulesStatus(ok, pending)).toBe('loading');
    expect(featureRulesStatus(pending, failed)).toBe('loading');
  });
  it('is loaded once both queries have data', () => {
    expect(featureRulesStatus(ok, ok)).toBe('loaded');
  });
  it('stays loaded after a failed background refetch (react-query keeps the data)', () => {
    expect(featureRulesStatus(refetchFailed, ok)).toBe('loaded');
    expect(featureRulesStatus(ok, refetchFailed)).toBe('loaded');
  });
  it('is error once both have settled and one failed without data', () => {
    expect(featureRulesStatus(failed, ok)).toBe('error');
    expect(featureRulesStatus(ok, failed)).toBe('error');
    expect(featureRulesStatus(failed, failed)).toBe('error');
  });
});

describe('featureGatesKnown', () => {
  it('is unknown only while loading; error counts as known (old redirect fallback, no wait)', () => {
    expect(featureGatesKnown('loading')).toBe(false);
    expect(featureGatesKnown('loaded')).toBe(true);
    expect(featureGatesKnown('error')).toBe(true);
  });
});

/** Mirrors the Index.tsx wiring of a gated route such as `appt-book/*`. */
function GatedApp({ visible, rulesStatus }: { visible: boolean; rulesStatus: FeatureRulesStatus }) {
  const decision = resolveFeatureGate(visible, featureGatesKnown(rulesStatus));
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

function renderGated(props: { visible: boolean; rulesStatus: FeatureRulesStatus }) {
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
    const { rerender } = renderGated({ visible: false, rulesStatus: 'loading' });
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent('/acme/appt-book/list');

    rerender({ visible: true, rulesStatus: 'loaded' });
    expect(screen.getByText('Appointment book')).toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent('/acme/appt-book/list');
  });

  it('still redirects a hidden feature to the dashboard once the rules are loaded', () => {
    const { rerender } = renderGated({ visible: false, rulesStatus: 'loading' });
    rerender({ visible: false, rulesStatus: 'loaded' });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent('/acme/dashboard');
  });

  it('redirects to the dashboard as soon as the rules fail to load (no 10 s wait)', () => {
    const { rerender } = renderGated({ visible: false, rulesStatus: 'loading' });
    rerender({ visible: false, rulesStatus: 'error' });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent('/acme/dashboard');
  });

  it('renders a visible feature right away even while the rules are loading (demo bypass)', () => {
    renderGated({ visible: true, rulesStatus: 'loading' });
    expect(screen.getByText('Appointment book')).toBeInTheDocument();
  });
});

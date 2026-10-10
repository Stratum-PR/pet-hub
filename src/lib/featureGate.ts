// U19 (FIX_LOG): feature-gated routes in Index.tsx.
// `useFeatureRollout().isFeatureVisible()` answers false until the feature_rollout and
// feature_visibility_rules queries have loaded, so a gate must not treat "false" as "hidden" until
// then — otherwise a reload or deep link to a gated page redirects to the dashboard for good.
import { useEffect, useState } from 'react';

export type FeatureGateDecision = 'render' | 'loading' | 'redirect';

/**
 * How long a gate waits for the feature rules before falling back to the old behavior (hidden →
 * redirect). Covers a business whose rules never load: react-query retries 3 times (1 s + 2 s + 4 s
 * back-off) and then stays in error, which `rolloutLoaded` never reports as loaded.
 */
export const FEATURE_GATE_LOAD_TIMEOUT_MS = 10_000;

/**
 * A visible feature renders right away (the demo-workspace bypass does not depend on the rules);
 * a not-visible one waits (loader) while the rules are unknown and redirects once they are known.
 */
export function resolveFeatureGate(visible: boolean, known: boolean): FeatureGateDecision {
  if (visible) return 'render';
  return known ? 'redirect' : 'loading';
}

/**
 * True once the feature rules have loaded (latched: a later failed background refetch keeps the
 * cached rules, so it must not put the page back behind a loader), or once `timeoutMs` has passed
 * without them.
 */
export function useFeatureGatesKnown(rolloutLoaded: boolean, timeoutMs = FEATURE_GATE_LOAD_TIMEOUT_MS): boolean {
  const [everLoaded, setEverLoaded] = useState(rolloutLoaded);
  const [timedOut, setTimedOut] = useState(false);
  if (rolloutLoaded && !everLoaded) setEverLoaded(true);
  const known = rolloutLoaded || everLoaded || timedOut;

  useEffect(() => {
    if (known) return;
    const id = window.setTimeout(() => setTimedOut(true), timeoutMs);
    return () => window.clearTimeout(id);
  }, [known, timeoutMs]);

  return known;
}

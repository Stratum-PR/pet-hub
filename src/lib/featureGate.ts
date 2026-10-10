// U19 / U26 (FIX_LOG): feature-gated routes in Index.tsx.
// `useFeatureRollout().isFeatureVisible()` answers false until the feature_rollout and
// feature_visibility_rules queries have loaded, so a gate must not treat "false" as "hidden" until
// then — otherwise a reload or deep link to a gated page redirects to the dashboard for good.
// U26: the gate waits for an explicit settled signal (`featureRulesStatus`) instead of U19's 10 s
// timeout. A failed load counts as settled and falls back to the old behavior (hidden → redirect).

export type FeatureGateDecision = 'render' | 'loading' | 'redirect';

/** 'loading' until both rule queries have settled; 'loaded' when both have data; otherwise 'error'. */
export type FeatureRulesStatus = 'loading' | 'loaded' | 'error';

/** The parts of a react-query result the status needs. */
type RulesQueryState = { status: 'pending' | 'error' | 'success'; data: unknown };

/**
 * Settled signal for the two feature-rule queries. A query that has data counts as loaded even if a
 * later background refetch failed (react-query keeps the data and reports status 'error'), so the
 * page never goes back behind a loader. 'error' means a query failed (after react-query's retries)
 * with no data to fall back on.
 */
export function featureRulesStatus(rollout: RulesQueryState, visibility: RulesQueryState): FeatureRulesStatus {
  if (rollout.data !== undefined && visibility.data !== undefined) return 'loaded';
  if (rollout.status === 'pending' || visibility.status === 'pending') return 'loading';
  return 'error';
}

/** The rules are known once they have loaded or failed. */
export function featureGatesKnown(status: FeatureRulesStatus): boolean {
  return status !== 'loading';
}

/**
 * A visible feature renders right away (the demo-workspace bypass does not depend on the rules);
 * a not-visible one waits (loader) while the rules are unknown and redirects once they are known.
 */
export function resolveFeatureGate(visible: boolean, known: boolean): FeatureGateDecision {
  if (visible) return 'render';
  return known ? 'redirect' : 'loading';
}

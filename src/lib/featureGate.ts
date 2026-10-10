// U19 (FIX_LOG): feature-gated routes in Index.tsx.
// Placeholder with the current (buggy) behavior so the new test runs red first.

export type FeatureGateDecision = 'render' | 'loading' | 'redirect';

export const FEATURE_GATE_LOAD_TIMEOUT_MS = 10_000;

export function resolveFeatureGate(visible: boolean, _known: boolean): FeatureGateDecision {
  return visible ? 'render' : 'redirect';
}

export function useFeatureGatesKnown(_rolloutLoaded: boolean, _timeoutMs = FEATURE_GATE_LOAD_TIMEOUT_MS): boolean {
  return true;
}

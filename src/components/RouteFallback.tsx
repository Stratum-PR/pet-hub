import { PawStagedLoadingFullscreen } from '@/components/PawStagedLoading';
import { t } from '@/lib/translations';

/**
 * Suspense fallback while a lazily loaded route's code downloads (P4-01).
 * Same full-screen paw loader that ProtectedRoute shows during auth checks, so a protected
 * route goes auth loader → this loader → page without a visual change. The paw fades in after
 * ~0.12 s (PawStagedLoading.css), so cached/fast chunk loads barely show it.
 */
export function RouteFallback() {
  return <PawStagedLoadingFullscreen label={t('common.loading')} />;
}

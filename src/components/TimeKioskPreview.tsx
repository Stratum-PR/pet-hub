import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { t } from '@/lib/translations';
import type { BusinessBrandingLayout } from '@/lib/businessBrandingLayout';
import { BrandingLogoKiosk } from '@/components/BrandingMark';
import { cn } from '@/lib/utils';

interface TimeKioskPreviewProps {
  logoUrl: string;
  layout: BusinessBrandingLayout['logo']['kiosk'];
  /**
   * Viewport-aware layout for full-page demo kiosk: responsive logo/PIN/keypad
   * without using saved kiosk branding pixel heights.
   */
  viewportFit?: boolean;
}

/**
 * Static preview of the TimeKiosk PIN-entry screen.
 * - No kiosk-lock logic
 * - No Supabase calls
 * - Just enough layout to preview how the logo + spacing look.
 */
export function TimeKioskPreview({ logoUrl, layout, viewportFit }: TimeKioskPreviewProps) {
  return (
    <div
      className={cn(
        'w-full min-h-0',
        viewportFit && 'flex min-h-0 flex-1 flex-col justify-center'
      )}
    >
      <div className={cn('text-center', viewportFit ? 'mb-4 shrink-0 sm:mb-6' : 'mb-6')}>
        <div
          className={cn(
            'flex items-center justify-center',
            viewportFit ? 'mb-3 sm:mb-4' : 'mb-4 gap-3'
          )}
        >
          {viewportFit ? (
            <img
              src={logoUrl}
              alt=""
              className="h-[clamp(2rem,12dvh,3.75rem)] w-auto max-w-[min(18rem,92vw)] object-contain"
            />
          ) : (
            <BrandingLogoKiosk logoUrl={logoUrl} layout={layout} alt="" />
          )}
        </div>
        <p
          className={cn(
            'text-muted-foreground',
            viewportFit
              ? 'line-clamp-3 px-2 text-sm leading-relaxed sm:line-clamp-none sm:text-base md:text-lg'
              : 'text-lg'
          )}
        >
          {t('timeTracking.description')}
        </p>
      </div>

      <Card className={cn('shadow-none', !viewportFit && 'hover:shadow-lg', viewportFit && 'min-h-0 shrink')}>
        <CardContent
          className={cn(
            viewportFit ? 'space-y-0 p-4 sm:p-6 md:p-8' : 'p-6 sm:p-8'
          )}
        >
          <div className={cn(viewportFit ? 'space-y-4 sm:space-y-6' : 'space-y-6')}>
            {/* PIN Display (empty) — 4 slots like the live punch clock */}
            <div className="flex justify-center">
              <div className={cn('flex', viewportFit ? 'gap-2 sm:gap-2' : 'gap-2')}>
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      'rounded-lg border-2 border-muted-foreground/30 flex items-center justify-center font-bold text-muted-foreground',
                      viewportFit
                        ? 'h-12 w-12 text-lg sm:h-14 sm:w-14 sm:text-2xl md:h-16 md:w-16'
                        : 'h-16 w-16 text-2xl'
                    )}
                  >
                    {/* No PIN dots while preview is idle */}
                  </div>
                ))}
              </div>
            </div>

            {/* Numeric Keypad (non-interactive) */}
            <div
              className={cn(
                'mx-auto grid max-w-md grid-cols-3',
                viewportFit ? 'gap-2 sm:gap-3 md:gap-4' : 'gap-4'
              )}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <Button
                  key={num}
                  size="lg"
                  variant="outline"
                  className={cn(
                    'font-bold disabled:opacity-100',
                    viewportFit
                      ? 'h-12 min-h-0 px-0 text-lg sm:h-14 sm:text-2xl md:h-20 md:text-2xl'
                      : 'h-20 text-2xl'
                  )}
                  disabled
                >
                  {num}
                </Button>
              ))}
              <Button
                size="lg"
                variant="outline"
                className={cn(
                  'disabled:opacity-100',
                  viewportFit
                    ? 'h-12 min-h-0 px-1.5 text-xs sm:h-14 sm:text-base md:h-20 md:text-xl'
                    : 'h-20 text-xl'
                )}
                disabled
              >
                {t('timeKiosk.clear')}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className={cn(
                  'font-bold disabled:opacity-100',
                  viewportFit
                    ? 'h-12 min-h-0 px-0 text-lg sm:h-14 sm:text-2xl md:h-20 md:text-2xl'
                    : 'h-20 text-2xl'
                )}
                disabled
              >
                0
              </Button>
              <Button
                size="lg"
                variant="outline"
                className={cn(
                  'disabled:opacity-100',
                  viewportFit
                    ? 'h-12 min-h-0 px-0 text-lg sm:h-14 sm:text-xl md:h-20 md:text-xl'
                    : 'h-20 text-xl'
                )}
                disabled
              >
                &larr;
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


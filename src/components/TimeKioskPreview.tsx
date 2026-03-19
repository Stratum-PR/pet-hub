import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { t } from '@/lib/translations';

interface TimeKioskPreviewProps {
  logoUrl: string;
  zoom: number;
  logoHeightPx?: number;
}

/**
 * Static preview of the TimeKiosk PIN-entry screen.
 * - No kiosk-lock logic
 * - No Supabase calls
 * - Just enough layout to preview how the logo + spacing look.
 */
export function TimeKioskPreview({ logoUrl, zoom, logoHeightPx = 48 }: TimeKioskPreviewProps) {
  return (
    <div className="w-full">
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-3 mb-4">
          <img
            src={logoUrl}
            alt=""
            aria-hidden
            className="w-auto max-w-[240px] object-contain"
            style={{
              height: logoHeightPx,
              transform: `scale(${zoom})`,
              transformOrigin: 'center',
            }}
          />
        </div>
        <p className="text-muted-foreground text-lg">{t('timeTracking.description')}</p>
      </div>

      <Card className="shadow-lg">
        <CardContent className="p-6 sm:p-8">
          <div className="space-y-6">
            {/* PIN Display (empty) */}
            <div className="flex justify-center">
              <div className="flex gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-16 h-16 rounded-lg border-2 border-muted-foreground/30 flex items-center justify-center text-2xl font-bold text-muted-foreground"
                  >
                    {/* No PIN dots while preview is idle */}
                  </div>
                ))}
              </div>
            </div>

            {/* Numeric Keypad (non-interactive) */}
            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <Button key={num} size="lg" variant="outline" className="h-20 text-2xl font-bold" disabled>
                  {num}
                </Button>
              ))}
              <Button size="lg" variant="outline" className="h-20 text-xl" disabled>
                {t('timeKiosk.clear')}
              </Button>
              <Button size="lg" variant="outline" className="h-20 text-2xl font-bold" disabled>
                0
              </Button>
              <Button size="lg" variant="outline" className="h-20 text-xl" disabled>
                &larr;
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground mt-2">{t('timeKiosk.managersEnterPinHint')}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


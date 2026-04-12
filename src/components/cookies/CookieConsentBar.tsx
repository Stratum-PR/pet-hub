import { Link } from 'react-router-dom';
import { Cookie, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useCookieConsent } from '@/contexts/CookieConsentContext';
import { t } from '@/lib/translations';
import { cn } from '@/lib/utils';
import { ConditionalAnalytics } from '@/components/cookies/ConditionalAnalytics';

export function CookieConsentBar() {
  const {
    needsBanner,
    preferencesOpen,
    openPreferences,
    closePreferences,
    draft,
    setDraft,
    acceptAll,
    rejectOptional,
    saveCustom,
  } = useCookieConsent();

  return (
    <>
      <ConditionalAnalytics />

      {needsBanner ? (
        <div
          role="dialog"
          aria-labelledby="cookie-banner-title"
          aria-describedby="cookie-banner-desc"
          className={cn(
            'fixed inset-x-0 bottom-0 z-[100] border-t border-border bg-card/95 text-card-foreground shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur-md',
            'dark:shadow-[0_-8px_30px_rgba(0,0,0,0.45)]',
          )}
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:py-5">
            <div className="flex gap-3 md:max-w-[58%]">
              <div className="mt-0.5 hidden shrink-0 sm:block">
                <Cookie className="h-8 w-8 text-primary" aria-hidden />
              </div>
              <div className="space-y-1 text-sm leading-relaxed">
                <p id="cookie-banner-title" className="font-semibold text-foreground">
                  {t('cookies.bannerTitle')}
                </p>
                <p id="cookie-banner-desc" className="text-muted-foreground">
                  {t('cookies.bannerBody')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('cookies.bannerProcessors')}
                </p>
                <Link
                  to="/privacy"
                  className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                >
                  {t('cookies.privacyLink')}
                </Link>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => openPreferences()}
              >
                <Settings2 className="mr-1.5 h-4 w-4" aria-hidden />
                {t('cookies.customize')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="rounded-full"
                onClick={() => rejectOptional()}
              >
                {t('cookies.rejectOptional')}
              </Button>
              <Button type="button" size="sm" className="rounded-full" onClick={() => acceptAll()}>
                {t('cookies.acceptAll')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog
        open={preferencesOpen}
        onOpenChange={(open) => {
          if (!open) closePreferences();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card text-card-foreground sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('cookies.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('cookies.dialogIntro')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{t('cookies.catNecessaryTitle')}</p>
                  <p className="text-xs text-muted-foreground">{t('cookies.catNecessaryDesc')}</p>
                </div>
                <Switch checked disabled aria-readonly />
              </div>
            </div>

            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{t('cookies.catPreferencesTitle')}</p>
                  <p className="text-xs text-muted-foreground">{t('cookies.catPreferencesDesc')}</p>
                </div>
                <Switch
                  checked={draft.preferences}
                  onCheckedChange={(v) => setDraft({ preferences: Boolean(v) })}
                  aria-label={t('cookies.catPreferencesTitle')}
                />
              </div>
            </div>

            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{t('cookies.catAnalyticsTitle')}</p>
                  <p className="text-xs text-muted-foreground">{t('cookies.catAnalyticsDesc')}</p>
                </div>
                <Switch
                  checked={draft.analytics}
                  onCheckedChange={(v) => setDraft({ analytics: Boolean(v) })}
                  aria-label={t('cookies.catAnalyticsTitle')}
                />
              </div>
            </div>

            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{t('cookies.catMarketingTitle')}</p>
                  <p className="text-xs text-muted-foreground">{t('cookies.catMarketingDesc')}</p>
                </div>
                <Switch
                  checked={draft.marketing}
                  onCheckedChange={(v) => setDraft({ marketing: Boolean(v) })}
                  aria-label={t('cookies.catMarketingTitle')}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">{t('cookies.paymentFootnote')}</p>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="rounded-full" onClick={() => closePreferences()}>
              {t('cookies.cancel')}
            </Button>
            <Button type="button" variant="secondary" className="rounded-full" onClick={() => rejectOptional()}>
              {t('cookies.rejectOptional')}
            </Button>
            <Button type="button" className="rounded-full" onClick={() => saveCustom()}>
              {t('cookies.saveChoices')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

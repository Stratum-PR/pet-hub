import { Link } from 'react-router-dom';
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
import { ConditionalAnalytics } from '@/components/cookies/ConditionalAnalytics';

const cookieBannerTitleClass =
  'text-center font-sans text-sm font-semibold uppercase tracking-[0.2em] text-primary sm:text-base';

function CookieCategoryToggles({
  draft,
  setDraft,
}: {
  draft: { preferences: boolean; analytics: boolean; marketing: boolean };
  setDraft: (next: Partial<{ preferences: boolean; analytics: boolean; marketing: boolean }>) => void;
}) {
  return (
    <div className="space-y-4 py-1">
      <div className="rounded-xl border border-border bg-muted/50 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">{t('cookies.catNecessaryTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('cookies.catNecessaryDesc')}</p>
          </div>
          <Switch checked disabled aria-readonly />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">{t('cookies.catPreferencesTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('cookies.catPreferencesDesc')}</p>
          </div>
          <Switch
            checked={draft.preferences}
            onCheckedChange={(v) => setDraft({ preferences: Boolean(v) })}
            aria-label={t('cookies.catPreferencesTitle')}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">{t('cookies.catAnalyticsTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('cookies.catAnalyticsDesc')}</p>
          </div>
          <Switch
            checked={draft.analytics}
            onCheckedChange={(v) => setDraft({ analytics: Boolean(v) })}
            aria-label={t('cookies.catAnalyticsTitle')}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">{t('cookies.catMarketingTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('cookies.catMarketingDesc')}</p>
          </div>
          <Switch
            checked={draft.marketing}
            onCheckedChange={(v) => setDraft({ marketing: Boolean(v) })}
            aria-label={t('cookies.catMarketingTitle')}
          />
        </div>
      </div>
    </div>
  );
}

export function CookieConsentBar() {
  const {
    needsBanner,
    bannerGranularOpen,
    preferencesOpen,
    openPreferences,
    closePreferences,
    dismissBannerGranular,
    draft,
    setDraft,
    acceptAll,
    rejectOptional,
    saveCustom,
  } = useCookieConsent();

  const dialogOpen = preferencesOpen && !needsBanner;

  return (
    <>
      <ConditionalAnalytics />

      {needsBanner ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={bannerGranularOpen ? 'cookie-settings-title' : 'cookie-policy-title'}
            aria-describedby={bannerGranularOpen ? 'cookie-settings-desc' : 'cookie-policy-desc'}
            className="w-full max-w-md rounded-2xl border border-border/80 bg-card/95 px-6 py-8 text-card-foreground shadow-xl backdrop-blur-xl sm:px-8 sm:py-10"
          >
            {!bannerGranularOpen ? (
              <>
                <h2 id="cookie-policy-title" className={cookieBannerTitleClass}>
                  {t('cookies.policyTitle')}
                </h2>
                <p id="cookie-policy-desc" className="mt-5 text-left text-sm leading-relaxed text-muted-foreground">
                  {t('cookies.policyBody')}{' '}
                  <Link
                    to="/privacy#cookie-notice"
                    className="font-medium text-primary underline underline-offset-2 hover:text-primary/90"
                  >
                    {t('cookies.cookieNoticeLink')}
                  </Link>
                  {t('cookies.policyBodyEnd')}
                </p>
                <div className="mt-8 flex flex-col gap-2">
                  <Button type="button" className="w-full uppercase tracking-wide" onClick={() => acceptAll()}>
                    {t('cookies.acceptAllCaps')}
                  </Button>
                  <Button type="button" variant="outline" className="w-full uppercase tracking-wide" onClick={() => rejectOptional()}>
                    {t('cookies.rejectAllCaps')}
                  </Button>
                  <Button type="button" variant="secondary" className="w-full uppercase tracking-wide" onClick={() => openPreferences()}>
                    {t('cookies.settingsCaps')}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 id="cookie-settings-title" className={cookieBannerTitleClass}>
                  {t('cookies.dialogTitle')}
                </h2>
                <p id="cookie-settings-desc" className="mt-2 text-center text-xs text-muted-foreground">
                  {t('cookies.dialogIntro')}
                </p>
                <div className="mt-5 max-h-[min(52vh,22rem)] overflow-y-auto pr-1">
                  <CookieCategoryToggles draft={draft} setDraft={setDraft} />
                </div>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={() => dismissBannerGranular()}>
                    {t('cookies.back')}
                  </Button>
                  <Button type="button" className="sm:min-w-[10rem]" onClick={() => saveCustom()}>
                    {t('cookies.saveChoices')}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closePreferences();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card text-card-foreground sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('cookies.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('cookies.dialogIntro')}</DialogDescription>
          </DialogHeader>

          <CookieCategoryToggles draft={draft} setDraft={setDraft} />

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

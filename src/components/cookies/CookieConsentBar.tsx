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

const COOKIE_ACTION_BTN =
  'w-full rounded-none border-0 py-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-none bg-[#9B1B1D] hover:bg-[#85191f] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#9B1B1D]';

function CookieCategoryToggles({
  draft,
  setDraft,
}: {
  draft: { preferences: boolean; analytics: boolean; marketing: boolean };
  setDraft: (next: Partial<{ preferences: boolean; analytics: boolean; marketing: boolean }>) => void;
}) {
  return (
    <div className="space-y-4 py-1">
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-900">{t('cookies.catNecessaryTitle')}</p>
            <p className="text-xs text-neutral-600">{t('cookies.catNecessaryDesc')}</p>
          </div>
          <Switch checked disabled aria-readonly />
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-900">{t('cookies.catPreferencesTitle')}</p>
            <p className="text-xs text-neutral-600">{t('cookies.catPreferencesDesc')}</p>
          </div>
          <Switch
            checked={draft.preferences}
            onCheckedChange={(v) => setDraft({ preferences: Boolean(v) })}
            aria-label={t('cookies.catPreferencesTitle')}
          />
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-900">{t('cookies.catAnalyticsTitle')}</p>
            <p className="text-xs text-neutral-600">{t('cookies.catAnalyticsDesc')}</p>
          </div>
          <Switch
            checked={draft.analytics}
            onCheckedChange={(v) => setDraft({ analytics: Boolean(v) })}
            aria-label={t('cookies.catAnalyticsTitle')}
          />
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-900">{t('cookies.catMarketingTitle')}</p>
            <p className="text-xs text-neutral-600">{t('cookies.catMarketingDesc')}</p>
          </div>
          <Switch
            checked={draft.marketing}
            onCheckedChange={(v) => setDraft({ marketing: Boolean(v) })}
            aria-label={t('cookies.catMarketingTitle')}
          />
        </div>
      </div>

      <p className="text-xs text-neutral-600">{t('cookies.paymentFootnote')}</p>
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
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={bannerGranularOpen ? 'cookie-settings-title' : 'cookie-policy-title'}
            aria-describedby={bannerGranularOpen ? 'cookie-settings-desc' : 'cookie-policy-desc'}
            className="w-full max-w-md border border-neutral-200 bg-white px-6 py-8 text-neutral-900 shadow-xl sm:px-8 sm:py-10"
          >
            {!bannerGranularOpen ? (
              <>
                <h2
                  id="cookie-policy-title"
                  className="text-center font-serif text-base font-normal uppercase tracking-[0.2em] text-[#9B1B1D] sm:text-lg"
                >
                  {t('cookies.policyTitle')}
                </h2>
                <p id="cookie-policy-desc" className="mt-5 text-left text-sm leading-relaxed text-neutral-800">
                  {t('cookies.policyBody')}{' '}
                  <Link to="/privacy#cookie-notice" className="font-medium underline underline-offset-2">
                    {t('cookies.cookieNoticeLink')}
                  </Link>
                  {t('cookies.policyBodyEnd')}
                </p>
                <div className="mt-8 flex flex-col gap-0.5 bg-white">
                  <button type="button" className={COOKIE_ACTION_BTN} onClick={() => acceptAll()}>
                    {t('cookies.acceptAllCaps')}
                  </button>
                  <button type="button" className={COOKIE_ACTION_BTN} onClick={() => rejectOptional()}>
                    {t('cookies.rejectAllCaps')}
                  </button>
                  <button type="button" className={COOKIE_ACTION_BTN} onClick={() => openPreferences()}>
                    {t('cookies.settingsCaps')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2
                  id="cookie-settings-title"
                  className="text-center font-serif text-base font-normal uppercase tracking-[0.2em] text-[#9B1B1D] sm:text-lg"
                >
                  {t('cookies.dialogTitle')}
                </h2>
                <p id="cookie-settings-desc" className="mt-2 text-center text-xs text-neutral-600">
                  {t('cookies.dialogIntro')}
                </p>
                <div className="mt-5 max-h-[min(52vh,22rem)] overflow-y-auto pr-1">
                  <CookieCategoryToggles draft={draft} setDraft={setDraft} />
                </div>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-none border-neutral-300"
                    onClick={() => dismissBannerGranular()}
                  >
                    {t('cookies.back')}
                  </Button>
                  <Button
                    type="button"
                    className="rounded-none border-0 bg-[#9B1B1D] px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-[#85191f] focus-visible:ring-2 focus-visible:ring-[#9B1B1D] focus-visible:ring-offset-2 sm:min-w-[10rem]"
                    onClick={() => saveCustom()}
                  >
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

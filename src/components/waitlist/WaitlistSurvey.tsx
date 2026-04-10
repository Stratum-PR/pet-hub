import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { t } from '@/lib/translations';
import { waitlistFetch } from '@/lib/waitlistApi';
import { cn } from '@/lib/utils';

const PAIN_MAX = 500;

type Props = {
  surveyToken: string;
};

function SelectableRadioRow({
  value,
  labelText,
  selected,
  namePrefix,
}: {
  value: string;
  labelText: string;
  selected: boolean;
  namePrefix: string;
}) {
  const rid = `${namePrefix}-${value.replace(/[^a-z0-9]+/gi, '-')}`;
  return (
    <label
      htmlFor={rid}
      className={cn(
        'w-full text-left rounded-2xl border-2 px-4 py-3.5 transition-all duration-200 flex items-center gap-3 cursor-pointer',
        selected
          ? 'border-[#D4FF00] bg-[#D4FF00]/15 shadow-sm ring-1 ring-[#D4FF00]/40'
          : 'border-border/70 bg-white/50 hover:border-slate-300 hover:bg-white/80',
      )}
    >
      <RadioGroupItem value={value} id={rid} className="border-slate-400 shrink-0" />
      <span className="font-medium text-slate-900 flex-1">{labelText}</span>
    </label>
  );
}

export function WaitlistSurvey({ surveyToken }: Props) {
  const [businessName, setBusinessName] = useState('');
  const [groomerCount, setGroomerCount] = useState<string>('');
  const [currentTools, setCurrentTools] = useState<string>('');
  const [biggestPain, setBiggestPain] = useState('');
  const [ath, setAth] = useState(false);
  const [nomina, setNomina] = useState(false);
  const [spanishUi, setSpanishUi] = useState(false);
  const [onlineBooking, setOnlineBooking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      const res = await waitlistFetch('waitlist-survey', {
        method: 'POST',
        body: JSON.stringify({
          survey_token: surveyToken,
          business_name: businessName.trim() || null,
          groomer_count: groomerCount || null,
          current_tools: currentTools || null,
          biggest_pain: biggestPain.trim().slice(0, PAIN_MAX) || null,
          wants_ath_movil: ath,
          wants_nomina_pr: nomina,
          wants_spanish_ui: spanishUi,
          wants_online_booking: onlineBooking,
        }),
      });
      if (res.ok) {
        setDone(true);
      } else {
        setError(t('waitlist.surveySubmitError'));
      }
    } catch {
      setError(t('waitlist.surveySubmitError'));
    } finally {
      setLoading(false);
    }
  }

  if (skipped || done) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-border/60 bg-white/50 px-6 py-8 text-center',
          done && 'border-emerald-200/80 bg-emerald-50/40',
        )}
      >
        <p className="text-slate-800 font-medium">
          {done ? t('waitlist.surveyThanks') : t('waitlist.surveySkip')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-left">
      <section className="rounded-2xl border border-border/60 bg-white/45 backdrop-blur-sm p-5 md:p-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t('waitlist.surveyStep1')}
        </h3>
        <p className="text-base font-semibold text-slate-900 -mt-1">{t('waitlist.surveyQ1')}</p>
        <RadioGroup
          value={groomerCount}
          onValueChange={setGroomerCount}
          className="grid gap-2 sm:grid-cols-2"
        >
          {(
            [
              ['1', 'waitlist.surveyQ1solo'],
              ['2-3', 'waitlist.surveyQ1_2_3'],
              ['4-6', 'waitlist.surveyQ1_4_6'],
              ['7+', 'waitlist.surveyQ1_7plus'],
            ] as const
          ).map(([value, key]) => (
            <SelectableRadioRow
              key={value}
              value={value}
              labelText={t(key)}
              selected={groomerCount === value}
              namePrefix="groomer"
            />
          ))}
        </RadioGroup>
      </section>

      <section className="rounded-2xl border border-border/60 bg-white/45 backdrop-blur-sm p-5 md:p-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t('waitlist.surveyStep2')}
        </h3>
        <p className="text-base font-semibold text-slate-900 -mt-1">{t('waitlist.surveyQ2')}</p>
        <RadioGroup
          value={currentTools}
          onValueChange={setCurrentTools}
          className="grid gap-2 sm:grid-cols-1"
        >
          {(
            [
              ['pen-paper', 'waitlist.toolPenPaper'],
              ['spreadsheet', 'waitlist.toolSheet'],
              ['gingr', 'waitlist.toolGingr'],
              ['daysmart', 'waitlist.toolDaySmart'],
              ['other', 'waitlist.toolOther'],
            ] as const
          ).map(([value, key]) => (
            <SelectableRadioRow
              key={value}
              value={value}
              labelText={t(key)}
              selected={currentTools === value}
              namePrefix="tool"
            />
          ))}
        </RadioGroup>
      </section>

      <section className="rounded-2xl border border-border/60 bg-white/45 backdrop-blur-sm p-5 md:p-6 space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t('waitlist.surveyStep3')}
        </h3>
        <Label htmlFor="waitlist-pain" className="text-base font-semibold text-slate-900">
          {t('waitlist.surveyQ3')}
        </Label>
        <Textarea
          id="waitlist-pain"
          maxLength={PAIN_MAX}
          value={biggestPain}
          onChange={(e) => setBiggestPain(e.target.value)}
          rows={4}
          className="resize-y min-h-[100px] rounded-xl border-2 border-border/80 bg-white/90 text-slate-900 placeholder:text-slate-400 focus-visible:ring-[#D4FF00] focus-visible:border-[#D4FF00]/60"
          placeholder=""
        />
        <p className="text-xs text-muted-foreground text-right tabular-nums">
          {biggestPain.length}/{PAIN_MAX}
        </p>
      </section>

      <section className="rounded-2xl border border-border/60 bg-white/45 backdrop-blur-sm p-5 md:p-6 space-y-3">
        <Label htmlFor="waitlist-biz" className="text-base font-semibold text-slate-900">
          {t('waitlist.businessNameOptional')}
        </Label>
        <Input
          id="waitlist-biz"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className="rounded-xl border-2 border-border/80 bg-white/90 h-11 text-slate-900 focus-visible:ring-[#D4FF00]"
        />
      </section>

      <section className="rounded-2xl border border-border/60 bg-white/45 backdrop-blur-sm p-5 md:p-6 space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t('waitlist.surveyStep4')}
        </h3>
        <p className="text-base font-semibold text-slate-900">{t('waitlist.surveyQ4')}</p>
        <div className="space-y-2">
          {(
            [
              [ath, setAth, 'waitlist.featureAth'],
              [nomina, setNomina, 'waitlist.featureNomina'],
              [spanishUi, setSpanishUi, 'waitlist.featureSpanish'],
              [onlineBooking, setOnlineBooking, 'waitlist.featureBooking'],
            ] as const
          ).map(([checked, setChecked, key], i) => (
            <label
              key={i}
              className="flex items-start gap-3 rounded-xl border border-border/70 bg-white/50 px-4 py-3.5 cursor-pointer hover:bg-white/80 transition-colors"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(v) => setChecked(v === true)}
                className="mt-0.5 border-slate-400 data-[state=checked]:bg-[#D4FF00] data-[state=checked]:text-slate-900 data-[state=checked]:border-[#D4FF00]"
              />
              <span className="text-sm font-medium text-slate-900 leading-snug">{t(key)}</span>
            </label>
          ))}
        </div>
      </section>

      {error ? (
        <p className="text-sm text-destructive text-center font-medium" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
        <Button
          type="button"
          onClick={() => void submit()}
          disabled={loading}
          className="rounded-full bg-[#D4FF00] text-black hover:bg-[#BFEF00] font-semibold px-8 h-11 shadow-md"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : t('waitlist.surveySubmit')}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-full border-2 border-slate-200 bg-white/70 text-slate-800 hover:bg-white font-medium"
          onClick={() => setSkipped(true)}
        >
          {t('waitlist.surveySkip')}
        </Button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { t } from '@/lib/translations';
import { useLanguage } from '@/contexts/LanguageContext';
import { waitlistFetch } from '@/lib/waitlistApi';
import { cn } from '@/lib/utils';

const PAIN_MAX = 500;
const OTHER_MAX = 180;

type Props = {
  surveyToken: string;
  onFinished?: () => void;
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

const TOOL_KEYS = ['pen-paper', 'spreadsheet', 'software', 'other'] as const;
type ToolKey = (typeof TOOL_KEYS)[number];

export function WaitlistSurvey({ surveyToken, onFinished }: Props) {
  useLanguage();
  const [groomerCount, setGroomerCount] = useState<string>('');
  const [tools, setTools] = useState<Set<ToolKey>>(new Set());
  const [toolsOther, setToolsOther] = useState('');
  const [biggestPain, setBiggestPain] = useState('');
  const [featAth, setFeatAth] = useState(false);
  const [featCosto, setFeatCosto] = useState(false);
  const [featNomina, setFeatNomina] = useState(false);
  const [featStaff, setFeatStaff] = useState(false);
  const [featSpanish, setFeatSpanish] = useState(false);
  const [featCitas, setFeatCitas] = useState(false);
  const [featCobrar, setFeatCobrar] = useState(false);
  const [featInventory, setFeatInventory] = useState(false);
  const [featReports, setFeatReports] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTool(key: ToolKey) {
    setTools((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  async function submit() {
    setError(null);
    if (!groomerCount) {
      setError(t('waitlist.surveyErrorAnswerQuestion', { n: 1 }));
      return;
    }
    if (tools.size === 0) {
      setError(t('waitlist.surveyErrorAnswerQuestion', { n: 2 }));
      return;
    }
    if (tools.has('other') && toolsOther.trim().length > OTHER_MAX) {
      setError(t('waitlist.surveyErrorOtherLength'));
      return;
    }
    const anyFeat =
      featAth ||
      featCosto ||
      featNomina ||
      featStaff ||
      featSpanish ||
      featCitas ||
      featCobrar ||
      featInventory ||
      featReports;
    if (!anyFeat) {
      setError(t('waitlist.surveyErrorAnswerQuestion', { n: 3 }));
      return;
    }

    setLoading(true);
    try {
      const res = await waitlistFetch('waitlist-survey', {
        method: 'POST',
        body: JSON.stringify({
          survey_token: surveyToken,
          groomer_count: groomerCount,
          tools_selected: Array.from(tools),
          tools_other: tools.has('other') ? toolsOther.trim().slice(0, OTHER_MAX) || null : null,
          biggest_pain: biggestPain.trim().slice(0, PAIN_MAX) || null,
          wants_ath_movil: featAth,
          wants_costo: featCosto,
          wants_nomina_pr: featNomina,
          wants_staff_management: featStaff,
          wants_spanish_ui: featSpanish,
          wants_online_booking: featCitas,
          wants_charge_online: featCobrar,
          wants_inventory: featInventory,
          wants_advanced_reports: featReports,
        }),
      });
      if (res.ok) {
        setDone(true);
      } else {
        let msg = t('waitlist.surveySubmitError');
        try {
          const j = (await res.json()) as { error?: string };
          if (j.error === 'invalid_groomer_count') msg = t('waitlist.surveyErrorAnswerQuestion', { n: 1 });
          else if (j.error === 'tools_required') msg = t('waitlist.surveyErrorAnswerQuestion', { n: 2 });
          else if (j.error === 'features_required') msg = t('waitlist.surveyErrorAnswerQuestion', { n: 3 });
        } catch {
          /* ignore */
        }
        setError(msg);
      }
    } catch {
      setError(t('waitlist.surveySubmitError'));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-border/60 bg-white/50 px-6 py-8 text-center space-y-4',
          'border-emerald-200/80 bg-emerald-50/40',
        )}
      >
        <p className="text-slate-800 font-medium">{t('waitlist.surveyThanks')}</p>
        {onFinished ? (
          <Button
            type="button"
            onClick={onFinished}
            className="rounded-full bg-[#D4FF00] text-black hover:bg-[#BFEF00] font-semibold px-8 h-11 shadow-md"
          >
            {t('waitlist.continueHome')}
          </Button>
        ) : null}
      </div>
    );
  }

  const toolCheckbox = (key: ToolKey, labelKey: string) => (
    <label
      key={key}
      className="flex items-start gap-3 rounded-xl border border-border/70 bg-white/50 px-4 py-3.5 cursor-pointer hover:bg-white/80 transition-colors"
    >
      <Checkbox
        checked={tools.has(key)}
        onCheckedChange={() => toggleTool(key)}
        className="mt-0.5 border-slate-400 data-[state=checked]:bg-[#D4FF00] data-[state=checked]:text-slate-900 data-[state=checked]:border-[#D4FF00]"
      />
      <span className="text-sm font-medium text-slate-900 leading-snug flex-1">{t(labelKey)}</span>
    </label>
  );

  const featureRows: [boolean, (v: boolean) => void, string][] = [
    [featAth, setFeatAth, 'waitlist.featureFAthMovil'],
    [featCosto, setFeatCosto, 'waitlist.featureFCosto'],
    [featNomina, setFeatNomina, 'waitlist.featureFNomina'],
    [featStaff, setFeatStaff, 'waitlist.featureFStaff'],
    [featSpanish, setFeatSpanish, 'waitlist.featureFSpanish'],
    [featCitas, setFeatCitas, 'waitlist.featureFCitas'],
    [featCobrar, setFeatCobrar, 'waitlist.featureFCobrar'],
    [featInventory, setFeatInventory, 'waitlist.featureFInventory'],
    [featReports, setFeatReports, 'waitlist.featureFReports'],
  ];

  return (
    <div className="space-y-8 text-left">
      <section className="rounded-2xl border border-border/60 bg-white/45 backdrop-blur-sm p-5 md:p-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t('waitlist.surveyStep1')}</h3>
        <p className="text-base font-semibold text-slate-900 -mt-1">{t('waitlist.surveyQ1')}</p>
        <RadioGroup value={groomerCount} onValueChange={setGroomerCount} className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ['1', 'waitlist.surveyQ1solo'],
              ['2-5', 'waitlist.surveyQ1_2_5'],
              ['6-9', 'waitlist.surveyQ1_6_9'],
              ['10+', 'waitlist.surveyQ1_10plus'],
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
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t('waitlist.surveyStep2')}</h3>
        <p className="text-base font-semibold text-slate-900 -mt-1">{t('waitlist.surveyQ2')}</p>
        <p className="text-xs text-muted-foreground">{t('waitlist.surveyQ2Hint')}</p>
        <div className="space-y-2">
          {toolCheckbox('pen-paper', 'waitlist.toolPenPaper')}
          {toolCheckbox('spreadsheet', 'waitlist.toolSheet')}
          {toolCheckbox('software', 'waitlist.toolSoftware')}
          {toolCheckbox('other', 'waitlist.toolOther')}
        </div>
        {tools.has('other') ? (
          <div className="space-y-1.5 pl-1">
            <Label htmlFor="waitlist-tools-other" className="text-sm text-muted-foreground">
              {t('waitlist.toolOtherDetail')}
            </Label>
            <Input
              id="waitlist-tools-other"
              maxLength={OTHER_MAX}
              value={toolsOther}
              onChange={(e) => setToolsOther(e.target.value)}
              className="rounded-xl border-2 border-border/80 bg-white/90 h-11 text-slate-900 focus-visible:ring-[#D4FF00]"
              placeholder={t('waitlist.toolOtherPlaceholder')}
            />
            <p className="text-xs text-muted-foreground text-right tabular-nums">
              {toolsOther.length}/{OTHER_MAX}
            </p>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border/60 bg-white/45 backdrop-blur-sm p-5 md:p-6 space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t('waitlist.surveyStep3')}</h3>
        <p className="text-base font-semibold text-slate-900">{t('waitlist.surveyQ4')}</p>
        <p className="text-xs text-muted-foreground">{t('waitlist.surveyQ4Hint')}</p>
        <div className="space-y-2">
          {featureRows.map(([checked, setChecked, key], i) => (
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

      <section className="rounded-2xl border border-border/60 bg-white/45 backdrop-blur-sm p-5 md:p-6 space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t('waitlist.surveyStep4')}</h3>
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

      {error ? (
        <p className="text-sm text-destructive text-center font-medium" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-center pt-2">
        <Button
          type="button"
          onClick={() => void submit()}
          disabled={loading}
          className="rounded-full bg-[#D4FF00] text-black hover:bg-[#BFEF00] font-semibold px-8 h-11 shadow-md"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : t('waitlist.surveySubmit')}
        </Button>
      </div>
    </div>
  );
}

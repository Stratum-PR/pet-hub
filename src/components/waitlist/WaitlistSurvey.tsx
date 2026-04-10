import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { t } from '@/lib/translations';
import { waitlistFetch } from '@/lib/waitlistApi';

const PAIN_MAX = 500;

type Props = {
  surveyToken: string;
};

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

  async function submit() {
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
      if (res.ok) setDone(true);
    } finally {
      setLoading(false);
    }
  }

  if (skipped || done) {
    return (
      <p className="text-center text-muted-foreground py-4">
        {done ? t('waitlist.surveyThanks') : t('waitlist.surveySkip')}
      </p>
    );
  }

  return (
    <div className="mt-8 space-y-6 text-left max-w-lg mx-auto">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium mb-2">{t('waitlist.surveyQ1')}</legend>
        {(
          [
            ['1', 'waitlist.surveyQ1solo'],
            ['2-3', 'waitlist.surveyQ1_2_3'],
            ['4-6', 'waitlist.surveyQ1_4_6'],
            ['7+', 'waitlist.surveyQ1_7plus'],
          ] as const
        ).map(([value, key]) => (
          <label key={value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="groomer_count"
              value={value}
              checked={groomerCount === value}
              onChange={() => setGroomerCount(value)}
              className="accent-[#D4FF00]"
            />
            <span className="text-sm">{t(key)}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium mb-2">{t('waitlist.surveyQ2')}</legend>
        {(
          [
            ['pen-paper', 'waitlist.toolPenPaper'],
            ['spreadsheet', 'waitlist.toolSheet'],
            ['gingr', 'waitlist.toolGingr'],
            ['daysmart', 'waitlist.toolDaySmart'],
            ['other', 'waitlist.toolOther'],
          ] as const
        ).map(([value, key]) => (
          <label key={value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="current_tools"
              value={value}
              checked={currentTools === value}
              onChange={() => setCurrentTools(value)}
              className="accent-[#D4FF00]"
            />
            <span className="text-sm">{t(key)}</span>
          </label>
        ))}
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="waitlist-pain">{t('waitlist.surveyQ3')}</Label>
        <Textarea
          id="waitlist-pain"
          maxLength={PAIN_MAX}
          value={biggestPain}
          onChange={(e) => setBiggestPain(e.target.value)}
          rows={3}
          className="resize-y min-h-[80px]"
        />
        <p className="text-xs text-muted-foreground text-right">
          {biggestPain.length}/{PAIN_MAX}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="waitlist-biz">{t('waitlist.businessNameOptional')}</Label>
        <Input id="waitlist-biz" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">{t('waitlist.surveyQ4')}</p>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={ath} onCheckedChange={(v) => setAth(v === true)} />
          <span className="text-sm">{t('waitlist.featureAth')}</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={nomina} onCheckedChange={(v) => setNomina(v === true)} />
          <span className="text-sm">{t('waitlist.featureNomina')}</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={spanishUi} onCheckedChange={(v) => setSpanishUi(v === true)} />
          <span className="text-sm">{t('waitlist.featureSpanish')}</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={onlineBooking} onCheckedChange={(v) => setOnlineBooking(v === true)} />
          <span className="text-sm">{t('waitlist.featureBooking')}</span>
        </label>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
        <Button
          type="button"
          onClick={() => void submit()}
          disabled={loading}
          className="bg-[#D4FF00] text-black hover:bg-[#BFEF00] rounded-full font-semibold"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t('waitlist.surveySubmit')}
        </Button>
        <Button type="button" variant="ghost" className="rounded-full" onClick={() => setSkipped(true)}>
          {t('waitlist.surveySkip')}
        </Button>
      </div>
    </div>
  );
}

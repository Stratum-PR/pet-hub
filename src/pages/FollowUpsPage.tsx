import { useEffect, useMemo, useState } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Download, Link2, Loader2, PhoneCall } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PawLoadedContent } from '@/components/PawLoadedContent';
import { useAuth } from '@/contexts/AuthContext';
import { useBusinessId } from '@/hooks/useBusinessId';
import { useCanManageAutomations } from '@/hooks/useCanManageAutomations';
import { useResolvedBusinessSlug } from '@/hooks/useResolvedBusinessSlug';
import { supabase } from '@/integrations/supabase/client';
import { columnLabel, sourceDef, toCsv } from '@/lib/automations';
import { devConsole } from '@/lib/clientDebug';
import { formatPhoneNumberDisplay } from '@/lib/phoneFormat';
import { FOLLOW_UP_OUTCOMES, followUpKeys, logFollowUp, useFollowUpCandidates, type FollowUpCandidate, type FollowUpOutcome } from '@/lib/followUps';
import { getLanguage, t } from '@/lib/translations';

const ALL = '__all__';

export function FollowUpsPage() {
  const businessId = useBusinessId();
  const slug = useResolvedBusinessSlug();
  const { user } = useAuth();
  const { canManage } = useCanManageAutomations();
  const queryClient = useQueryClient();
  const candidatesQuery = useFollowUpCandidates(businessId);
  const [groomer, setGroomer] = useState(ALL);
  const [busy, setBusy] = useState<string | null>(null);

  const weeksQuery = useQuery({
    queryKey: ['settings_follow_up_weeks', businessId ?? 'none'],
    enabled: !!businessId,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await supabase.from('settings' as any).select('follow_up_weeks').eq('business_id', businessId!).maybeSingle();
      return Number((data as { follow_up_weeks?: number } | null)?.follow_up_weeks ?? 6);
    },
  });
  const [weeks, setWeeks] = useState('6');
  useEffect(() => {
    if (weeksQuery.data) setWeeks(String(weeksQuery.data));
  }, [weeksQuery.data]);

  const rows = useMemo(() => candidatesQuery.data ?? [], [candidatesQuery.data]);
  const groomers = useMemo(() => [...new Set(rows.map((r) => r.usual_groomer).filter(Boolean))] as string[], [rows]);
  const shown = groomer === ALL ? rows : rows.filter((r) => r.usual_groomer === groomer);
  const bookingLink = slug ? `${window.location.origin}/${slug}/reservar` : '';

  const refresh = () => businessId && void queryClient.invalidateQueries({ queryKey: followUpKeys.list(businessId) });

  const log = async (r: FollowUpCandidate, outcome: FollowUpOutcome, callBackOn?: string) => {
    if (!businessId || !user) return;
    setBusy(r.pet_id);
    try {
      await logFollowUp({ businessId, petId: r.pet_id, clientId: r.client_id, outcome, callBackOn: callBackOn ?? null, userId: user.id });
      toast.success(t('fu.logged'));
      refresh();
    } catch (e) {
      devConsole.error('[followUps] log', e);
      toast.error(t('common.genericError'));
    } finally {
      setBusy(null);
    }
  };

  const saveWeeks = async () => {
    const n = Math.min(52, Math.max(1, Number(weeks) || 6));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from('settings' as any).update({ follow_up_weeks: n }).eq('business_id', businessId!);
    if (error) {
      toast.error(t('common.genericError'));
      return;
    }
    toast.success(t('fu.intervalSaved'));
    void queryClient.invalidateQueries({ queryKey: ['settings_follow_up_weeks', businessId] });
    refresh();
  };

  const exportCsv = () => {
    const def = sourceDef('follow_ups')!;
    const cols = def.defaultColumns;
    const l = getLanguage() === 'en' ? 'en' : 'es';
    const headers = Object.fromEntries(cols.map((c) => [c, columnLabel(c, l)]));
    const csv = toCsv(
      shown.map((r) => ({
        client: r.client_name,
        phone: r.phone,
        pet: r.pet_name,
        last_visit: r.last_visit,
        weeks_since: r.weeks_since,
        usual_service: r.usual_service,
        usual_groomer: r.usual_groomer,
        last_contact: r.last_outcome ? `${t(`fu.outcome.${r.last_outcome}`)} ${r.last_contact_at ? format(new Date(r.last_contact_at), 'dd/MM') : ''}` : '',
      })),
      cols,
      headers,
    );
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `para-llamar-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PawLoadedContent loading={candidatesQuery.isLoading} loaderLabel={t('fu.title')}>
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <PhoneCall className="h-5 w-5 text-primary" />
              {t('fu.title')}
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">{t('fu.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {bookingLink && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(bookingLink);
                  toast.success(t('fu.linkCopied'));
                }}
              >
                <Link2 className="mr-2 h-4 w-4" />
                {t('fu.copyLink')}
              </Button>
            )}
            <Button variant="outline" size="sm" disabled={shown.length === 0} onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" />
              {t('fu.export')}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          {groomers.length > 0 && (
            <Select value={groomer} onValueChange={setGroomer}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('fu.allGroomers')}</SelectItem>
                {groomers.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {canManage && (
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{t('fu.intervalLabel')}</Label>
                <Input type="number" min={1} max={52} className="w-24" value={weeks} onChange={(e) => setWeeks(e.target.value)} />
              </div>
              <Button size="sm" variant="secondary" disabled={String(weeksQuery.data ?? 6) === weeks} onClick={() => void saveWeeks()}>
                {t('auto.save')}
              </Button>
            </div>
          )}
          <Badge variant="secondary" className="ml-auto">
            {t('fu.count', { n: shown.length })}
          </Badge>
        </div>

        {candidatesQuery.isError && <p className="rounded-lg border border-destructive/40 p-4 text-sm">{t('auto.loadError')}</p>}

        {shown.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{t('fu.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {shown.map((r) => (
              <li key={r.pet_id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="font-semibold">
                      {r.pet_name} <span className="font-normal text-muted-foreground">· {r.breed || r.species}</span>
                    </p>
                    <p className="text-sm">{r.client_name}</p>
                    {r.phone && (
                      <a href={`tel:${r.phone}`} className="text-sm font-medium text-primary hover:underline">
                        {formatPhoneNumberDisplay(r.phone)}
                      </a>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {t('fu.lastVisit')}: {r.last_visit} ({t('fu.weeksAgo', { n: r.weeks_since })})
                      {r.usual_service ? ` · ${t('fu.usual')}: ${r.usual_service}` : ''}
                      {r.usual_groomer ? ` · ${r.usual_groomer}` : ''}
                    </p>
                    {r.last_outcome && (
                      <p className="text-xs text-muted-foreground">
                        {t('fu.lastContact')}: {t(`fu.outcome.${r.last_outcome}`)}
                        {r.last_contact_at ? ` · ${format(new Date(r.last_contact_at), 'dd/MM HH:mm')}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {busy === r.pet_id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      FOLLOW_UP_OUTCOMES.map((o) =>
                        o === 'call_back' ? (
                          <CallBackButton key={o} onPick={(d) => void log(r, o, d)} />
                        ) : (
                          <Button key={o} size="sm" variant={o === 'booked' ? 'default' : 'outline'} onClick={() => void log(r, o)}>
                            {t(`fu.outcome.${o}`)}
                          </Button>
                        ),
                      )
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PawLoadedContent>
  );
}

function CallBackButton({ onPick }: { onPick: (date: string) => void }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => format(new Date(Date.now() + 2 * 86_400_000), 'yyyy-MM-dd'));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          {t('fu.outcome.call_back')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 space-y-2">
        <Label className="text-xs">{t('fu.callBackOn')}</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Button
          size="sm"
          className="w-full"
          onClick={() => {
            setOpen(false);
            onPick(date);
          }}
        >
          {t('auto.save')}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export default FollowUpsPage;

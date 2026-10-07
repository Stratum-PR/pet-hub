import { useCallback, useEffect, useState } from 'react';
import { FlaskConical, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { devConsole } from '@/lib/clientDebug';
import { t } from '@/lib/translations';
import { useLanguage } from '@/contexts/LanguageContext';

interface SimPayment {
  ecommerceId: string;
  ecommerceStatus: 'OPEN' | 'CONFIRM' | 'COMPLETED' | 'CANCEL';
  total: number;
  phone: string;
  businessName: string;
  items: { name: string; quantity: number }[];
  createdAt: string;
  cancelReason?: string;
}

/**
 * Test mode only: plays the client's ATH Móvil app. Lists this business's simulated charges
 * so staff can approve or decline them. No real money is involved.
 */
export function AthSimulatorPhone() {
  useLanguage();
  const [payments, setPayments] = useState<SimPayment[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('athm-simulator/simulator/state', { method: 'GET' });
    if (error) {
      devConsole.error('[AthSimulatorPhone] state', error);
      return;
    }
    const d = data as { payments: SimPayment[]; configured: boolean };
    setConfigured(d.configured);
    setPayments(d.payments ?? []);
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 2000);
    return () => window.clearInterval(id);
  }, [load]);

  const act = async (id: string, action: 'approve' | 'decline') => {
    setBusyId(id);
    const { error } = await supabase.functions.invoke(`athm-simulator/simulator/payments/${id}/${action}`, { method: 'POST' });
    if (error) devConsole.error('[AthSimulatorPhone] action', error);
    setBusyId(null);
    void load();
  };

  const statusText = (p: SimPayment) =>
    p.ecommerceStatus === 'CANCEL'
      ? t(p.cancelReason === 'expired' ? 'payments.sim.status.expired' : 'payments.sim.status.canceled')
      : t(`payments.sim.status.${p.ecommerceStatus}`);

  return (
    <div className="mx-auto w-full max-w-sm space-y-4 py-2">
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <Smartphone className="h-5 w-5" /> {t('payments.sim.title')}
        </h1>
        <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
          <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t('payments.sim.explain')}
        </p>
      </div>

      {!configured ? (
        <p className="text-center text-sm text-muted-foreground">{t('payments.sim.notConfigured')}</p>
      ) : payments === null ? null : payments.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t('payments.sim.empty')}</p>
      ) : (
        payments.slice(0, 10).map((p) => (
          <div key={p.ecommerceId} className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-2xl font-bold tabular-nums">${Number(p.total).toFixed(2)}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{statusText(p)}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{p.businessName}</p>
            {p.items?.map((i, idx) => (
              <p key={idx} className="text-xs text-muted-foreground">
                {i.quantity} × {i.name}
              </p>
            ))}
            {p.ecommerceStatus === 'OPEN' ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="outline" disabled={busyId === p.ecommerceId} onClick={() => void act(p.ecommerceId, 'decline')}>
                  {t('payments.sim.decline')}
                </Button>
                <Button
                  className="bg-[#f26b21] text-white hover:bg-[#dd5f1c]"
                  disabled={busyId === p.ecommerceId}
                  onClick={() => void act(p.ecommerceId, 'approve')}
                >
                  {t('payments.sim.pay')}
                </Button>
              </div>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}

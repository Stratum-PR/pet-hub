import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ExternalLink, FlaskConical, Loader2, Smartphone, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPhoneNumber, unformatPhoneNumber } from '@/lib/phoneFormat';
import { t } from '@/lib/translations';
import { useResolvedBusinessSlug } from '@/hooks/useResolvedBusinessSlug';
import {
  ATH_MAX_CENTS,
  ATH_MIN_CENTS,
  callPayments,
  isFinalPaymentStatus,
  paymentErrorText,
  type AthMode,
  type PaymentAttempt,
} from '@/lib/payments';

type Step = 'phone' | 'waiting' | 'paid' | 'failed';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amountCents: number;
  mode: AthMode;
  defaultPhone?: string | null;
  appointmentId?: string | null;
  customerId?: string | null;
  description?: string;
  /** Called once when the payment is confirmed paid. */
  onPaid: (payment: PaymentAttempt) => void;
}

const POLL_MS = 2500;
const money = (c: number) => `$${(c / 100).toFixed(2)}`;

/**
 * ATH Móvil charge: staff enters the client's ATH Móvil phone, the client approves in the app,
 * Grumi finalizes automatically. In test mode the "client" approves on the simulated phone.
 */
export function AthMovilChargeDialog({
  open,
  onOpenChange,
  amountCents,
  mode,
  defaultPhone,
  appointmentId,
  customerId,
  description,
  onPaid,
}: Props) {
  const slug = useResolvedBusinessSlug();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState<PaymentAttempt | null>(null);
  const [failText, setFailText] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const paidSent = useRef(false);

  useEffect(() => {
    if (!open) return;
    setStep('phone');
    setPayment(null);
    setFailText('');
    paidSent.current = false;
    setPhone(unformatPhoneNumber(defaultPhone ?? '').slice(-10));
  }, [open, defaultPhone]);

  const applyStatus = useCallback(
    (p: PaymentAttempt) => {
      setPayment(p);
      if (p.status === 'succeeded') {
        setStep('paid');
        if (!paidSent.current) {
          paidSent.current = true;
          onPaid(p);
        }
      } else if (isFinalPaymentStatus(p.status)) {
        setFailText(t(`payments.charge.final.${p.status}`));
        setStep('failed');
      }
    },
    [onPaid],
  );

  // Poll while waiting for the client.
  useEffect(() => {
    if (!open || step !== 'waiting' || !payment) return;
    let stop = false;
    const tick = async () => {
      const { data } = await callPayments<{ payment: PaymentAttempt }>('ath_status', { paymentId: payment.id });
      if (!stop && data?.payment) applyStatus(data.payment);
    };
    const id = window.setInterval(() => void tick(), POLL_MS);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      stop = true;
      window.clearInterval(id);
      window.clearInterval(clock);
    };
  }, [open, step, payment, applyStatus]);

  const send = async () => {
    const digits = unformatPhoneNumber(phone);
    if (digits.length !== 10) {
      setFailText('');
      return;
    }
    setBusy(true);
    const { data, error } = await callPayments<{ payment: PaymentAttempt }>('ath_create', {
      amountCents,
      phone: digits,
      appointmentId: appointmentId ?? undefined,
      customerId: customerId ?? undefined,
      description,
    });
    setBusy(false);
    if (error || !data?.payment) {
      setFailText(paymentErrorText(error ?? undefined));
      setStep('failed');
      return;
    }
    setPayment(data.payment);
    setStep('waiting');
  };

  const cancelCharge = async () => {
    if (payment && step === 'waiting') {
      setBusy(true);
      const { data } = await callPayments<{ payment: PaymentAttempt }>('ath_cancel', { paymentId: payment.id });
      setBusy(false);
      // The client may have paid at the last second: respect the real status.
      if (data?.payment?.status === 'succeeded') {
        applyStatus(data.payment);
        return;
      }
    }
    onOpenChange(false);
  };

  const outOfRange = amountCents < ATH_MIN_CENTS || amountCents > ATH_MAX_CENTS;
  const remaining = payment?.expiresAt ? Math.max(0, Date.parse(payment.expiresAt) - now) : 0;
  const mmss = `${Math.floor(remaining / 60000)}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')}`;
  const approving = payment?.status === 'awaiting_capture' || payment?.status === 'authorizing';

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && step === 'waiting') {
          void cancelCharge();
          return;
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" /> {t('payments.charge.title')}
          </DialogTitle>
          <DialogDescription className="text-3xl font-semibold tabular-nums text-foreground">{money(amountCents)}</DialogDescription>
        </DialogHeader>

        {mode === 'simulator' ? (
          <p className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-900 dark:text-amber-100">
            <FlaskConical className="h-3.5 w-3.5 shrink-0" /> {t('payments.charge.testMode')}
          </p>
        ) : null}

        {step === 'phone' ? (
          <div className="space-y-4">
            {outOfRange ? (
              <p className="text-sm text-destructive">{t('payments.err.amount_out_of_range')}</p>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="ath-phone">{t('payments.charge.phoneLabel')}</Label>
              <Input
                id="ath-phone"
                inputMode="tel"
                autoFocus
                value={formatPhoneNumber(phone)}
                onChange={(e) => setPhone(unformatPhoneNumber(e.target.value).slice(0, 10))}
                onKeyDown={(e) => e.key === 'Enter' && !busy && unformatPhoneNumber(phone).length === 10 && void send()}
              />
              <p className="text-xs text-muted-foreground">{t('payments.charge.phoneHint')}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={() => void send()} disabled={busy || outOfRange || unformatPhoneNumber(phone).length !== 10}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('payments.charge.send')}
              </Button>
            </div>
          </div>
        ) : null}

        {step === 'waiting' ? (
          <div className="space-y-4 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <div>
              <p className="font-medium">{approving ? t('payments.charge.finishing') : t('payments.charge.waiting')}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('payments.charge.sentTo', { last4: payment?.phoneLast4 ?? '' })} · {mmss}
              </p>
            </div>
            {mode === 'simulator' && slug ? (
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <a href={`/${slug}/ath-simulador`} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" /> {t('payments.sim.openPhone')}
                </a>
              </Button>
            ) : null}
            <div>
              <Button variant="ghost" onClick={() => void cancelCharge()} disabled={busy || approving}>
                {t('payments.charge.cancel')}
              </Button>
            </div>
          </div>
        ) : null}

        {step === 'paid' ? (
          <div className="space-y-2 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <p className="font-medium">{t('payments.charge.paid')}</p>
            {payment?.receiptReference ? (
              <p className="break-all text-xs text-muted-foreground">
                {t('payments.charge.reference')}: {payment.receiptReference}
              </p>
            ) : null}
          </div>
        ) : null}

        {step === 'failed' ? (
          <div className="space-y-4 text-center">
            <XCircle className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="text-sm">{failText || t('payments.err.provider_error')}</p>
            <div className="flex justify-center gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {t('common.close')}
              </Button>
              <Button
                onClick={() => {
                  setPayment(null);
                  setStep('phone');
                }}
              >
                {t('payments.charge.tryAgain')}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

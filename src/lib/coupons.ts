import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { devConsole } from '@/lib/clientDebug';
import type { CouponKind } from '@/lib/automations';

export type CouponOffer = {
  id: string;
  business_id: string;
  name: string;
  kind: CouponKind;
  value: number | null;
  service_id: string | null;
  product_id: string | null;
  code_mode: 'unique' | 'shared';
  shared_code: string | null;
  valid_days: number | null;
  starts_on: string | null;
  expires_on: string | null;
  max_uses: number | null;
  one_per_client: boolean;
  online_booking: boolean;
  active: boolean;
  created_at: string;
};

export type IssuedCoupon = {
  id: string;
  offer_id: string;
  client_id: string | null;
  code: string;
  automation_id: string | null;
  issued_at: string;
  expires_at: string | null;
  status: 'active' | 'redeemed' | 'void';
  redeemed_at: string | null;
};

export type CouponRedemption = {
  id: string;
  offer_id: string;
  coupon_id: string | null;
  client_id: string | null;
  transaction_id: string | null;
  code: string;
  discount_cents: number;
  created_at: string;
};

/** check_coupon / check_booking_coupon result. */
export type CouponCheck = {
  ok?: boolean;
  valid?: boolean;
  reason?: string;
  offer_id?: string;
  coupon_id?: string | null;
  code?: string;
  kind?: CouponKind;
  value?: number | null;
  service_id?: string | null;
  product_id?: string | null;
  name?: string;
  service_name?: string | null;
  product_name?: string | null;
  expires?: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const couponOffersTable = () => supabase.from('coupon_offers' as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const couponsTable = () => supabase.from('coupons' as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const couponRedemptionsTable = () => supabase.from('coupon_redemptions' as any);

export const couponKeys = {
  offers: (businessId: string) => ['coupon_offers', businessId] as const,
  codes: (businessId: string) => ['coupons', businessId] as const,
  redemptions: (businessId: string) => ['coupon_redemptions', businessId] as const,
};

export function useCouponOffers(businessId: string | null) {
  return useQuery({
    queryKey: couponKeys.offers(businessId ?? 'none'),
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await couponOffersTable().select('*').eq('business_id', businessId!).order('created_at', { ascending: false });
      if (error) {
        devConsole.error('[coupons] offers', error);
        throw error;
      }
      return (data ?? []) as unknown as CouponOffer[];
    },
    retry: false,
  });
}

export function useIssuedCoupons(businessId: string | null) {
  return useQuery({
    queryKey: couponKeys.codes(businessId ?? 'none'),
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await couponsTable()
        .select('id, offer_id, client_id, code, automation_id, issued_at, expires_at, status, redeemed_at')
        .eq('business_id', businessId!)
        .order('issued_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as IssuedCoupon[];
    },
    retry: false,
  });
}

export function useCouponRedemptions(businessId: string | null) {
  return useQuery({
    queryKey: couponKeys.redemptions(businessId ?? 'none'),
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await couponRedemptionsTable()
        .select('id, offer_id, coupon_id, client_id, transaction_id, code, discount_cents, created_at')
        .eq('business_id', businessId!)
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      const rows = (data ?? []) as unknown as CouponRedemption[];
      // Sales the coupons brought in.
      const ids = rows.map((r) => r.transaction_id).filter(Boolean) as string[];
      const totals = new Map<string, number>();
      for (let i = 0; i < ids.length; i += 200) {
        const { data: txns } = await supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .from('transactions' as any)
          .select('id, total')
          .in('id', ids.slice(i, i + 200));
        for (const t of (txns ?? []) as unknown as { id: string; total: number }[]) totals.set(t.id, Number(t.total ?? 0));
      }
      return rows.map((r) => ({ ...r, sale_cents: r.transaction_id ? totals.get(r.transaction_id) ?? 0 : 0 }));
    },
    retry: false,
  });
}

/** Staff at checkout: validate a code for this business (and client). */
export async function checkCoupon(code: string, clientId: string | null): Promise<CouponCheck> {
  const { data, error } = await supabase.rpc('check_coupon' as never, { p_code: code, p_client_id: clientId } as never);
  if (error) {
    devConsole.error('[coupons] check', error);
    throw error;
  }
  return (data ?? { ok: false, reason: 'invalid' }) as CouponCheck;
}

export async function redeemCoupon(args: {
  code: string;
  clientId: string | null;
  transactionId: string;
  appointmentId: string | null;
  discountCents: number;
}): Promise<CouponCheck> {
  const { data, error } = await supabase.rpc(
    'redeem_coupon' as never,
    {
      p_code: args.code,
      p_client_id: args.clientId,
      p_transaction_id: args.transactionId,
      p_appointment_id: args.appointmentId,
      p_discount_cents: args.discountCents,
    } as never,
  );
  if (error) throw error;
  return (data ?? { ok: false }) as CouponCheck;
}

/** Whether this business has any coupon offer (hides the checkout coupon box otherwise, and before the migration). */
export function useHasCouponOffers(businessId: string | null) {
  return useQuery({
    queryKey: ['coupon_offers', 'any', businessId ?? 'none'],
    enabled: !!businessId,
    queryFn: async () => {
      const { count, error } = await couponOffersTable().select('id', { count: 'exact', head: true }).eq('business_id', businessId!);
      if (error) return false;
      return (count ?? 0) > 0;
    },
    retry: false,
    staleTime: 60_000,
  });
}

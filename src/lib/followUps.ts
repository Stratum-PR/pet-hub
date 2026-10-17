import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { devConsole } from '@/lib/clientDebug';

export type FollowUpCandidate = {
  pet_id: string;
  pet_name: string;
  species: string | null;
  breed: string | null;
  client_id: string;
  client_name: string;
  phone: string | null;
  email: string | null;
  contact_preference: string;
  last_visit: string;
  weeks_since: number;
  interval_weeks: number;
  usual_service: string | null;
  usual_groomer: string | null;
  last_outcome: FollowUpOutcome | null;
  last_contact_at: string | null;
  call_back_on: string | null;
};

export type FollowUpOutcome = 'booked' | 'call_back' | 'no_answer' | 'not_interested';
export const FOLLOW_UP_OUTCOMES: FollowUpOutcome[] = ['booked', 'call_back', 'no_answer', 'not_interested'];

export const followUpKeys = { list: (businessId: string) => ['follow_up_candidates', businessId] as const };

export function useFollowUpCandidates(businessId: string | null) {
  return useQuery({
    queryKey: followUpKeys.list(businessId ?? 'none'),
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('follow_up_candidates' as never, { p_business_id: businessId } as never);
      if (error) {
        devConsole.error('[followUps] candidates', error);
        throw error;
      }
      return (data ?? []) as unknown as FollowUpCandidate[];
    },
    retry: false,
  });
}

export async function logFollowUp(args: {
  businessId: string;
  petId: string;
  clientId: string | null;
  outcome: FollowUpOutcome;
  callBackOn?: string | null;
  note?: string | null;
  userId: string;
}) {
  const { error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('client_follow_ups' as any)
    .insert({
      business_id: args.businessId,
      pet_id: args.petId,
      client_id: args.clientId,
      outcome: args.outcome,
      call_back_on: args.callBackOn || null,
      note: args.note || null,
      created_by: args.userId,
    });
  if (error) throw error;
}

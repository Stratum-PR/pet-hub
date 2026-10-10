let seq = 0;

/**
 * A realtime channel name unique to one subscription. supabase-js (2.117+) returns the existing channel when a topic is
 * reused, and adding listeners to an already-subscribed channel throws, so two mounted copies of the same hook
 * (e.g. Index + Quick charge) must never share a name. Call it inside the effect that subscribes.
 */
export function uniqueChannelName(base: string): string {
  seq += 1;
  return `${base}-${seq}`;
}

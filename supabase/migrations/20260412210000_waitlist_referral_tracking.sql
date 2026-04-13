-- Track the exact referral code string used at signup (referred_by is the referrer UUID).
ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS referred_by_code text;

COMMENT ON COLUMN public.waitlist.referral_code IS 'Unique shareable code for this row (what they share with others).';
COMMENT ON COLUMN public.waitlist.referred_by IS 'UUID of the referrer waitlist row, if any.';
COMMENT ON COLUMN public.waitlist.referred_by_code IS 'Normalized referral code submitted at signup when referred_by is set; for analytics and exports.';

CREATE INDEX IF NOT EXISTS idx_waitlist_referred_by_code ON public.waitlist (referred_by_code)
  WHERE referred_by_code IS NOT NULL;

-- Analytics: referral_code = shareable code for this row; referred_by = referrer waitlist.id;
-- referred_by_code = normalized code string submitted at signup (when referred_by is set).

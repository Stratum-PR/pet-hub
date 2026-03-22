-- Notifications inbox: metadata for deep links (appointments, pets, inventory, transactions).
-- 60-day visibility is enforced in the application layer.

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS product_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS notification_type text DEFAULT 'general';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS appointment_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS pet_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS transaction_id uuid;

UPDATE public.notifications SET notification_type = 'general' WHERE notification_type IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own notifications" ON public.notifications;
CREATE POLICY "Users select own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own notifications" ON public.notifications;
CREATE POLICY "Users insert own notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

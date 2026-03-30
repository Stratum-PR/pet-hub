-- Re-inviting revokes pending → 'revoked', then inserts a new 'pending'. The old
-- UNIQUE (staff_id, status) allowed at most ONE 'revoked' row per staff, so the
-- second revoke/update collided. Only 'pending' must be unique per staff.

ALTER TABLE public.staff_invites
  DROP CONSTRAINT IF EXISTS staff_invites_unique_staff_status;

CREATE UNIQUE INDEX IF NOT EXISTS staff_invites_one_pending_per_staff
  ON public.staff_invites (staff_id)
  WHERE (status = 'pending');

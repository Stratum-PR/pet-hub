-- set_profile_business_id(uid, business_id) is a SECURITY DEFINER helper with no caller check: anyone able to
-- call it could attach any profile (including their own) to any business as manager.
-- It is only meant to be called from complete_manager_signup (runs as the owner), never from the API.
-- Applied to production 2026-10-06.
REVOKE ALL ON FUNCTION public.set_profile_business_id(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- `gen_random_bytes` requires the `pgcrypto` extension. Some environments omit it,
-- which breaks `generate_impersonation_token` ("function gen_random_bytes(integer) does not exist").
-- Use core-only entropy (md5 + random + clock_timestamp) for a 64-hex-char token.

CREATE OR REPLACE FUNCTION public.generate_impersonation_token(target_business_id UUID)
RETURNS TABLE(token TEXT, expires_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_token TEXT;
  token_expires_at TIMESTAMP WITH TIME ZONE;
  current_admin_id UUID;
BEGIN
  current_admin_id := auth.uid();

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = current_admin_id AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Only super admins can generate impersonation tokens';
  END IF;

  new_token :=
    md5(random()::text || clock_timestamp()::text || random()::text)
    || md5(random()::text || clock_timestamp()::text || random()::text);

  token_expires_at := now() + INTERVAL '1 hour';

  INSERT INTO public.admin_impersonation_tokens (admin_id, business_id, token, expires_at)
  VALUES (current_admin_id, target_business_id, new_token, token_expires_at);

  RETURN QUERY SELECT new_token, token_expires_at;
END;
$$;

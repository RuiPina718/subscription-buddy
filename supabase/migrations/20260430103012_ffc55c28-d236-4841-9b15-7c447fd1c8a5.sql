CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  is_admin boolean,
  subscription_count bigint,
  active_subscription_count bigint,
  monthly_total numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::text,
    p.full_name,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id AND ur.role = 'admin') AS is_admin,
    COALESCE((SELECT COUNT(*) FROM public.subscriptions s WHERE s.user_id = u.id), 0) AS subscription_count,
    COALESCE((SELECT COUNT(*) FROM public.subscriptions s WHERE s.user_id = u.id AND s.status = 'active'), 0) AS active_subscription_count,
    COALESCE((
      SELECT SUM(
        CASE WHEN s.billing_cycle = 'yearly' THEN s.amount / 12.0 ELSE s.amount END
      )
      FROM public.subscriptions s
      WHERE s.user_id = u.id AND s.status = 'active'
    ), 0)::numeric AS monthly_total
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete yourself';
  END IF;
  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;

-- Audit log table
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  actor_email text,
  action text NOT NULL,
  target_id uuid,
  target_email text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit log"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_admin_audit_log_created_at ON public.admin_audit_log (created_at DESC);

-- Helper to record audit entries (callable from clients; checks admin role)
CREATE OR REPLACE FUNCTION public.admin_log_action(
  _action text,
  _target_id uuid DEFAULT NULL,
  _target_email text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_email text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT email INTO _actor_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.admin_audit_log (actor_id, actor_email, action, target_id, target_email, metadata)
  VALUES (auth.uid(), _actor_email, _action, _target_id, _target_email, COALESCE(_metadata, '{}'::jsonb));
END;
$$;

-- Update admin_list_users to also return banned_until
DROP FUNCTION IF EXISTS public.admin_list_users();
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(
  user_id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  banned_until timestamptz,
  is_admin boolean,
  subscription_count bigint,
  active_subscription_count bigint,
  monthly_total numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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
    u.banned_until,
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id AND ur.role = 'admin') AS is_admin,
    COALESCE((SELECT COUNT(*) FROM public.subscriptions s WHERE s.user_id = u.id), 0) AS subscription_count,
    COALESCE((SELECT COUNT(*) FROM public.subscriptions s WHERE s.user_id = u.id AND s.status = 'active'), 0) AS active_subscription_count,
    COALESCE((
      SELECT SUM(CASE WHEN s.billing_cycle = 'yearly' THEN s.amount / 12.0 ELSE s.amount END)
      FROM public.subscriptions s
      WHERE s.user_id = u.id AND s.status = 'active'
    ), 0)::numeric AS monthly_total
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

-- Global stats
CREATE OR REPLACE FUNCTION public.admin_global_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT COUNT(*) FROM auth.users),
    'new_users_7d', (SELECT COUNT(*) FROM auth.users WHERE created_at > now() - interval '7 days'),
    'new_users_30d', (SELECT COUNT(*) FROM auth.users WHERE created_at > now() - interval '30 days'),
    'unconfirmed_users', (SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NULL),
    'banned_users', (SELECT COUNT(*) FROM auth.users WHERE banned_until IS NOT NULL AND banned_until > now()),
    'total_admins', (SELECT COUNT(*) FROM public.user_roles WHERE role = 'admin'),
    'total_subscriptions', (SELECT COUNT(*) FROM public.subscriptions),
    'active_subscriptions', (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'active'),
    'mrr', COALESCE((
      SELECT SUM(CASE WHEN billing_cycle = 'yearly' THEN amount / 12.0 ELSE amount END)
      FROM public.subscriptions WHERE status = 'active'
    ), 0),
    'arr', COALESCE((
      SELECT SUM(CASE WHEN billing_cycle = 'yearly' THEN amount ELSE amount * 12 END)
      FROM public.subscriptions WHERE status = 'active'
    ), 0),
    'top_services', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT name, COUNT(*) AS count
        FROM public.subscriptions WHERE status = 'active'
        GROUP BY name ORDER BY count DESC LIMIT 5
      ) t
    ), '[]'::jsonb),
    'by_category', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT COALESCE(c.name, 'Sem categoria') AS name,
               COALESCE(c.color, '#9b87f5') AS color,
               COUNT(*) AS count,
               SUM(CASE WHEN s.billing_cycle = 'yearly' THEN s.amount / 12.0 ELSE s.amount END) AS monthly
        FROM public.subscriptions s
        LEFT JOIN public.categories c ON c.id = s.category_id
        WHERE s.status = 'active'
        GROUP BY c.name, c.color ORDER BY monthly DESC NULLS LAST
      ) t
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

-- Get one user's subscriptions (for the admin user-detail drawer)
CREATE OR REPLACE FUNCTION public.admin_get_user_subscriptions(_user_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  amount numeric,
  currency text,
  billing_cycle billing_cycle,
  next_billing_date date,
  status subscription_status,
  category_name text,
  category_color text,
  last_used_at date,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT s.id, s.name, s.amount, s.currency, s.billing_cycle, s.next_billing_date, s.status,
         c.name, c.color, s.last_used_at, s.created_at
  FROM public.subscriptions s
  LEFT JOIN public.categories c ON c.id = s.category_id
  WHERE s.user_id = _user_id
  ORDER BY s.created_at DESC;
END;
$$;

CREATE TABLE public.google_calendar_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  scope text,
  calendar_id text NOT NULL DEFAULT 'primary',
  reminder_days_before smallint NOT NULL DEFAULT 2,
  sync_renewals boolean NOT NULL DEFAULT true,
  sync_reminders boolean NOT NULL DEFAULT true,
  sync_monthly_summary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "GCal tokens select own" ON public.google_calendar_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "GCal tokens insert own" ON public.google_calendar_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "GCal tokens update own" ON public.google_calendar_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "GCal tokens delete own" ON public.google_calendar_tokens FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_gcal_tokens_updated_at
BEFORE UPDATE ON public.google_calendar_tokens
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Track event ids per subscription so we can update/delete on changes
CREATE TABLE public.google_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subscription_id uuid,
  event_kind text NOT NULL, -- 'renewal' | 'reminder' | 'monthly_summary'
  google_event_id text NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "GCal events select own" ON public.google_calendar_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "GCal events insert own" ON public.google_calendar_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "GCal events update own" ON public.google_calendar_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "GCal events delete own" ON public.google_calendar_events FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_gcal_events_user_sub ON public.google_calendar_events(user_id, subscription_id);
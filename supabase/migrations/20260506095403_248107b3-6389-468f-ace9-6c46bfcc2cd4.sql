CREATE TABLE public.category_budgets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  monthly_limit numeric NOT NULL CHECK (monthly_limit >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id)
);

ALTER TABLE public.category_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Budgets select own" ON public.category_budgets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Budgets insert own" ON public.category_budgets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Budgets update own" ON public.category_budgets
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Budgets delete own" ON public.category_budgets
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_category_budgets_updated_at
  BEFORE UPDATE ON public.category_budgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_category_budgets_user ON public.category_budgets(user_id);
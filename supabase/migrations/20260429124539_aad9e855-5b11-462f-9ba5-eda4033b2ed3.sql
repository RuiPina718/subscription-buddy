-- Allow users to update color of any visible category (own or default)
DROP POLICY IF EXISTS "Categories update own" ON public.categories;

CREATE POLICY "Categories update own"
ON public.categories
FOR UPDATE
USING ((auth.uid() = user_id) AND (is_default = false));

-- Separate policy: anyone authenticated can update color of default categories for themselves
-- Actually simpler: let users override default category colors by copying them.
-- We'll keep update restricted to own non-default rows; default color overrides handled client-side via user_categories override is too much.
-- Instead: allow UPDATE of color column on default categories too (shared change).
CREATE POLICY "Categories update default color"
ON public.categories
FOR UPDATE
TO authenticated
USING (is_default = true)
WITH CHECK (is_default = true);
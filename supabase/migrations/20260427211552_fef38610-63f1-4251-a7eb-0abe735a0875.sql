
-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "Profiles select own" on public.profiles for select using (auth.uid() = id);
create policy "Profiles insert own" on public.profiles for insert with check (auth.uid() = id);
create policy "Profiles update own" on public.profiles for update using (auth.uid() = id);

-- ENUMS
create type public.billing_cycle as enum ('monthly','yearly');
create type public.subscription_status as enum ('active','cancelled');

-- CATEGORIES
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,  -- null = predefinida global
  name text not null,
  icon text not null default 'tag',
  color text not null default '#9b87f5',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.categories enable row level security;

create policy "Categories select own or default" on public.categories
  for select using (is_default = true or auth.uid() = user_id);
create policy "Categories insert own" on public.categories
  for insert with check (auth.uid() = user_id and is_default = false);
create policy "Categories update own" on public.categories
  for update using (auth.uid() = user_id and is_default = false);
create policy "Categories delete own" on public.categories
  for delete using (auth.uid() = user_id and is_default = false);

-- Seed default categories (user_id null so all users see them)
insert into public.categories (name, icon, color, is_default) values
  ('Streaming', 'play-circle', '#FF6B9D', true),
  ('Software', 'code', '#4FC3F7', true),
  ('Gaming', 'gamepad-2', '#9C7BFF', true),
  ('Saúde', 'heart-pulse', '#66E0A3', true),
  ('Música', 'music', '#FFB347', true),
  ('Outros', 'tag', '#94A3B8', true);

-- SUBSCRIPTIONS
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  category_id uuid references public.categories(id) on delete set null,
  amount numeric(10,2) not null check (amount >= 0),
  currency text not null default 'EUR',
  billing_cycle public.billing_cycle not null default 'monthly',
  billing_day smallint not null check (billing_day between 1 and 31),
  next_billing_date date not null,
  status public.subscription_status not null default 'active',
  last_used_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;

create policy "Subs select own" on public.subscriptions for select using (auth.uid() = user_id);
create policy "Subs insert own" on public.subscriptions for insert with check (auth.uid() = user_id);
create policy "Subs update own" on public.subscriptions for update using (auth.uid() = user_id);
create policy "Subs delete own" on public.subscriptions for delete using (auth.uid() = user_id);

create index subs_user_idx on public.subscriptions(user_id);
create index subs_next_billing_idx on public.subscriptions(next_billing_date);

-- Function to auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger subscriptions_updated before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

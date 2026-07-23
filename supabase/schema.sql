-- Poco cloud schema. Run this in the Supabase SQL editor (see SUPABASE.md).
-- Every table is owned per-user and locked down with row-level security so a
-- signed-in user can only ever see or change their own data.

-- ---- Profile: one row per user (name, goals, points, cosmetics, settings) ----
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  goals jsonb not null default '{"calories":2000,"steps":8000,"sleepHours":8.5}'::jsonb,
  points integer not null default 0,
  cosmetics jsonb not null default '{"unlocked":[],"equipped":null}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---- Check-ins: one row per user per day (the insight time-series) ----
create table if not exists public.checkins (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  sleep_hours numeric,
  sleep_quality smallint,
  mood smallint,
  steps integer,
  logged boolean not null default false,
  logged_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- ---- Meals: many per user per day, with full macros + timestamp ----
create table if not exists public.meals (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  name text,
  kcal numeric,
  protein numeric,
  fat numeric,
  carbs numeric,
  sugar numeric,
  fiber numeric,
  icon text,
  time text,
  source text,
  created_at timestamptz not null default now()
);
create index if not exists meals_user_date_idx on public.meals(user_id, date);

-- ---- Habits + their daily checks ----
create table if not exists public.habits (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  icon text,
  color text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.habit_checks (
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id text not null references public.habits(id) on delete cascade,
  date date not null,
  primary key (habit_id, date)
);

-- ---- Row-level security: users touch only their own rows ----
alter table public.profiles     enable row level security;
alter table public.checkins     enable row level security;
alter table public.meals        enable row level security;
alter table public.habits       enable row level security;
alter table public.habit_checks enable row level security;

create policy "own profile"      on public.profiles     for all using (auth.uid() = id)      with check (auth.uid() = id);
create policy "own checkins"     on public.checkins     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own meals"        on public.meals        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own habits"       on public.habits       for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own habit_checks" on public.habit_checks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

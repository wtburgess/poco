-- Poco — Supabase schema + Row-Level Security.
-- Safe to paste whole into the Supabase SQL editor; re-runnable (create-if-not-exists
-- for tables, drop-then-create for policies). Column names match app/src/supabase.js
-- (cloudLoad / cloudSync / cloudPushFull) exactly.
--
-- SECURITY: every table has RLS enabled with a single FOR ALL policy that scopes
-- rows to auth.uid(), in both USING (reads) and WITH CHECK (writes). A signed-in
-- user can only ever touch their own rows. Do not disable RLS.

-- ---- profiles: one row per user (name, points, goals, cosmetics, settings, review) ----
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text,
  points     integer default 0,
  goals      jsonb   default '{}'::jsonb,
  cosmetics  jsonb   default '{}'::jsonb,
  settings   jsonb   default '{}'::jsonb,
  review     jsonb   default '{}'::jsonb,
  updated_at timestamptz default now()
);
alter table public.profiles enable row level security;
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- ---- checkins: one row per user per day ----
create table if not exists public.checkins (
  user_id       uuid not null references auth.users (id) on delete cascade,
  date          date not null,
  sleep_hours   numeric,
  sleep_quality integer,
  mood          integer,
  steps         integer,
  gratitude     text,
  note          text,
  energy        text,
  logged        boolean default false,
  logged_at     timestamptz,
  updated_at    timestamptz default now(),
  primary key (user_id, date)
);
alter table public.checkins enable row level security;
drop policy if exists "own checkins" on public.checkins;
create policy "own checkins" on public.checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists checkins_user_idx on public.checkins (user_id);

-- ---- meals: many per user per day (id is client-generated) ----
create table if not exists public.meals (
  id         text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  date       date not null,
  name       text,
  kcal       integer,
  protein    numeric,
  fat        numeric,
  carbs      numeric,
  sugar      numeric,
  fiber      numeric,
  icon       text,
  time       text,
  source     text,
  created_at timestamptz default now()
);
alter table public.meals enable row level security;
drop policy if exists "own meals" on public.meals;
create policy "own meals" on public.meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists meals_user_date_idx on public.meals (user_id, date);

-- ---- habits: with Target (ceiling) + Emergency Floor ----
create table if not exists public.habits (
  id         text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text,
  icon       text,
  color      text,
  target     text,
  floor      text,
  sort_order integer default 0
);
alter table public.habits enable row level security;
drop policy if exists "own habits" on public.habits;
create policy "own habits" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists habits_user_idx on public.habits (user_id);

-- ---- habit_checks: a kept day. floor=false → full target, floor=true → floor only ----
create table if not exists public.habit_checks (
  user_id  uuid not null references auth.users (id) on delete cascade,
  habit_id text not null references public.habits (id) on delete cascade,
  date     date not null,
  floor    boolean not null default false,
  primary key (user_id, habit_id, date)
);
alter table public.habit_checks enable row level security;
drop policy if exists "own habit_checks" on public.habit_checks;
create policy "own habit_checks" on public.habit_checks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists habit_checks_user_idx on public.habit_checks (user_id);

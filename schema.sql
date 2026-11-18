-- The Fitness Challenge — Supabase schema
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.

------------------------------------------------------------------------
-- 1. Tables
------------------------------------------------------------------------
create table if not exists public.config (
  id         int  primary key default 1 check (id = 1),
  start_date date not null default '2026-09-01',
  penalty    int  not null default 20
);

create table if not exists public.participants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  since      date not null default '2026-09-01',
  quit_date  date,
  created_at timestamptz not null default now()
);

create table if not exists public.checkins (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  day            date not null,
  created_at     timestamptz not null default now(),
  unique (participant_id, day)
);

create table if not exists public.payments (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  amount         int  not null,
  day            date not null default ((now() at time zone 'utc')::date),
  note           text default '',
  created_at     timestamptz not null default now()
);

------------------------------------------------------------------------
-- 2. Row-level security
-- Anyone holding the public "anon" key (baked into the site) gets the
-- policies below. Nobody can touch the CODE — that lives in your Git repo.
------------------------------------------------------------------------
alter table public.config       enable row level security;
alter table public.participants enable row level security;
alter table public.checkins     enable row level security;
alter table public.payments     enable row level security;

-- The site (anon key) can READ everything and ADD rows. It can never DELETE
-- anything: a deleted check-in or payment is gone for good (people were
-- unchecking each other, and a stray tap on a phone once wiped a $40 payment).
-- Admin changes — start date, penalty, removing someone, fixing a wrong row —
-- are made from the Supabase dashboard. Wrong payments get a negative entry.
drop policy if exists "anon full config"       on public.config;
drop policy if exists "anon full participants" on public.participants;
drop policy if exists "anon full checkins"     on public.checkins;
drop policy if exists "anon full payments"     on public.payments;
drop policy if exists "anon read config"       on public.config;
drop policy if exists "anon read participants" on public.participants;
drop policy if exists "anon add participants"  on public.participants;
drop policy if exists "anon edit participants" on public.participants;
drop policy if exists "anon read checkins"     on public.checkins;
drop policy if exists "anon add checkins"      on public.checkins;
drop policy if exists "anon read payments"     on public.payments;
drop policy if exists "anon add payments"      on public.payments;

create policy "anon read config"       on public.config       for select to anon using (true);
-- Participants: add people, mark them quit / re-admitted — never delete.
create policy "anon read participants" on public.participants for select to anon using (true);
create policy "anon add participants"  on public.participants for insert to anon with check (true);
create policy "anon edit participants" on public.participants for update to anon using (true) with check (true);
-- Check-ins are final.
create policy "anon read checkins"     on public.checkins     for select to anon using (true);
create policy "anon add checkins"      on public.checkins     for insert to anon with check (true);
-- Payments are final too.
create policy "anon read payments"     on public.payments     for select to anon using (true);
create policy "anon add payments"      on public.payments     for insert to anon with check (true);

------------------------------------------------------------------------
-- 3. Realtime — so every open page updates the moment anyone checks in.
-- If a line errors with "already member of publication", ignore it.
------------------------------------------------------------------------
alter publication supabase_realtime add table public.config;
alter publication supabase_realtime add table public.participants;
alter publication supabase_realtime add table public.checkins;
alter publication supabase_realtime add table public.payments;

------------------------------------------------------------------------
-- 4. Seed: the challenge config + the 17-person roster.
------------------------------------------------------------------------
insert into public.config (id, start_date, penalty)
values (1, '2026-09-01', 20)
on conflict (id) do nothing;

insert into public.participants (name, since)
select name, '2026-09-01'::date
from unnest(array[
  'Adeeb','Alen','Antonio','Blake','Carlos','Drew','Eileen','Jeff',
  'Jim','Johnny','Jorge','Kati','Mo','Ozzy','Rafael','Simon','Vince'
]) as name
where not exists (select 1 from public.participants);

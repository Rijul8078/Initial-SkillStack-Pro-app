-- Run this in Supabase SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  is_suspended boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles
add column if not exists is_suspended boolean not null default false;

create table if not exists public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  completed_challenges jsonb not null default '{}'::jsonb,
  xp integer not null default 0,
  last_active timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'free' check (status in ('free', 'active', 'cancelled', 'expired')),
  plan text not null default 'free',
  started_at timestamptz,
  ends_at timestamptz,
  razorpay_order_id text,
  razorpay_payment_id text,
  amount integer,
  currency text default 'INR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;
create trigger trg_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.update_updated_at_column();

alter table public.profiles enable row level security;
alter table public.user_progress enable row level security;
alter table public.subscriptions enable row level security;

-- Profiles policies
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;

create policy "Users can read own profile"
on public.profiles for select
using (auth.uid() = id);

create policy "Users can insert own profile"
on public.profiles for insert
with check (auth.uid() = id and role = 'user' and is_suspended = false);

-- Progress policies
drop policy if exists "Users can read own progress" on public.user_progress;
drop policy if exists "Users can upsert own progress" on public.user_progress;

create policy "Users can read own progress"
on public.user_progress for select
using (auth.uid() = user_id);

create policy "Users can upsert own progress"
on public.user_progress for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Subscription policies
drop policy if exists "Users can read own subscription" on public.subscriptions;

create policy "Users can read own subscription"
on public.subscriptions for select
using (auth.uid() = user_id);

-- Optional: make your account admin
-- update public.profiles set role = 'admin' where id = '<your-auth-user-id>';

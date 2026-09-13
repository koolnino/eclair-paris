-- Schéma de référence Éclair Paris (Supabase)
create extension if not exists pgcrypto;

create table if not exists public.bakeries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  postal_code text,
  arrondissement smallint check (arrondissement between 1 and 20),
  latitude double precision not null,
  longitude double precision not null,
  phone text,
  website text,
  opening_hours jsonb,
  source_url text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.eclairs (
  id uuid primary key default gen_random_uuid(),
  bakery_id uuid not null references public.bakeries(id) on delete cascade,
  name text not null default 'Éclair au chocolat',
  price_eur numeric(6,2),
  description text,
  photo_url text,
  active boolean not null default true,
  source_url text,
  verified_at timestamptz,
  availability_status text not null default 'verified'
    check (availability_status in ('verified','reported','unknown','unavailable')),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  eclair_id uuid not null references public.eclairs(id) on delete cascade,
  chocolate_taste smallint not null check (chocolate_taste between 0 and 100),
  filling smallint not null check (filling between 0 and 100),
  choux_pastry smallint not null check (choux_pastry between 0 and 100),
  glaze smallint not null check (glaze between 0 and 100),
  texture_balance smallint not null check (texture_balance between 0 and 100),
  value_for_money smallint not null check (value_for_money between 0 and 100),
  score numeric(5,2) generated always as (
    chocolate_taste * 0.30 +
    filling * 0.20 +
    choux_pastry * 0.20 +
    glaze * 0.10 +
    texture_balance * 0.10 +
    value_for_money * 0.10
  ) stored,
  comment text,
  verified_tasting boolean not null default false,
  tasting_latitude double precision,
  tasting_longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, eclair_id)
);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  eclair_id uuid not null references public.eclairs(id) on delete cascade,
  status text not null default 'to_try' check (status in ('to_try','tasted')),
  created_at timestamptz not null default now(),
  primary key(user_id, eclair_id)
);

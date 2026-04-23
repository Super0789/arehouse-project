-- =====================================================================
-- Promotional Inventory Management — Phase 1
-- Migration 001: Schema (enums, tables, indexes, FKs)
-- =====================================================================
-- Run this first in the Supabase SQL editor.
-- Run 002_functions_triggers.sql, 003_rls.sql, then seed/001_seed.sql after.
-- =====================================================================

-- Extensions
create extension if not exists "pgcrypto";     -- gen_random_uuid()
create extension if not exists "citext";        -- case-insensitive codes

-- =====================================================================
-- ENUMS
-- =====================================================================
do $$ begin
  create type session_status as enum ('draft', 'morning_submitted', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role as enum ('admin', 'supervisor', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type movement_type as enum (
    'opening_stock',   -- admin adds stock to a supervisor
    'distributed',     -- supervisor -> promoter (morning)
    'returned',        -- promoter -> supervisor (close of day)
    'adjustment'       -- admin correction, with reason
  );
exception when duplicate_object then null; end $$;

-- =====================================================================
-- CORE ENTITIES
-- =====================================================================

-- Teams
create table if not exists teams (
  id          uuid primary key default gen_random_uuid(),
  team_name   text not null unique,
  area        text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Supervisors (one supervisor per team by convention; FK is not unique
-- in case a team ever needs multiple, but we enforce one-active via partial index)
create table if not exists supervisors (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  team_id     uuid not null references teams(id) on delete restrict,
  phone       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create unique index if not exists supervisors_one_active_per_team
  on supervisors (team_id) where active = true;

create index if not exists supervisors_team_idx on supervisors(team_id);

-- Promoters
create table if not exists promoters (
  id             uuid primary key default gen_random_uuid(),
  full_name      text not null,
  team_id        uuid not null references teams(id) on delete restrict,
  supervisor_id  uuid not null references supervisors(id) on delete restrict,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create index if not exists promoters_team_idx        on promoters(team_id);
create index if not exists promoters_supervisor_idx  on promoters(supervisor_id);

-- Promotional items
create table if not exists items (
  id          uuid primary key default gen_random_uuid(),
  item_name   text not null,
  item_code   citext unique,         -- optional SKU, case-insensitive
  category    text,
  unit        text not null default 'pcs',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Running balance per (supervisor, item).
-- Updated exclusively by the stock_movements trigger — never written to directly.
create table if not exists supervisor_stock (
  id                uuid primary key default gen_random_uuid(),
  supervisor_id     uuid not null references supervisors(id) on delete cascade,
  item_id           uuid not null references items(id)       on delete cascade,
  quantity_on_hand  integer not null default 0 check (quantity_on_hand >= 0),
  updated_at        timestamptz not null default now(),
  unique (supervisor_id, item_id)
);

create index if not exists supervisor_stock_supervisor_idx on supervisor_stock(supervisor_id);
create index if not exists supervisor_stock_item_idx       on supervisor_stock(item_id);

-- =====================================================================
-- DAILY WORKFLOW
-- =====================================================================

-- One session per supervisor per day (hard DB constraint).
-- Admin override is handled in the app layer by first soft-deleting /
-- reopening via an admin-only RPC; the unique index still holds.
create table if not exists daily_sessions (
  id              uuid primary key default gen_random_uuid(),
  session_date    date not null,
  team_id         uuid not null references teams(id)        on delete restrict,
  supervisor_id   uuid not null references supervisors(id)  on delete restrict,
  status          session_status not null default 'draft',
  notes           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  morning_submitted_at timestamptz,
  closed_at       timestamptz,
  unique (supervisor_id, session_date)
);

create index if not exists daily_sessions_date_idx         on daily_sessions(session_date);
create index if not exists daily_sessions_team_idx         on daily_sessions(team_id);
create index if not exists daily_sessions_supervisor_idx   on daily_sessions(supervisor_id);
create index if not exists daily_sessions_status_idx       on daily_sessions(status);

-- Morning: what each promoter received from the supervisor
create table if not exists morning_distribution (
  id                uuid primary key default gen_random_uuid(),
  daily_session_id  uuid not null references daily_sessions(id) on delete cascade,
  promoter_id       uuid not null references promoters(id)      on delete restrict,
  item_id           uuid not null references items(id)          on delete restrict,
  qty_given         integer not null check (qty_given >= 0),
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null,
  unique (daily_session_id, promoter_id, item_id)
);

create index if not exists morning_distribution_session_idx  on morning_distribution(daily_session_id);
create index if not exists morning_distribution_promoter_idx on morning_distribution(promoter_id);
create index if not exists morning_distribution_item_idx     on morning_distribution(item_id);

-- End of day: remaining with each promoter
create table if not exists promoter_closing (
  id                uuid primary key default gen_random_uuid(),
  daily_session_id  uuid not null references daily_sessions(id) on delete cascade,
  promoter_id       uuid not null references promoters(id)      on delete restrict,
  item_id           uuid not null references items(id)          on delete restrict,
  qty_remaining     integer not null check (qty_remaining >= 0),
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null,
  unique (daily_session_id, promoter_id, item_id)
);

create index if not exists promoter_closing_session_idx  on promoter_closing(daily_session_id);
create index if not exists promoter_closing_promoter_idx on promoter_closing(promoter_id);
create index if not exists promoter_closing_item_idx     on promoter_closing(item_id);

-- Full audit trail of all stock movements.
-- supervisor_stock is derived from the sum of these rows.
create table if not exists stock_movements (
  id              uuid primary key default gen_random_uuid(),
  movement_type   movement_type not null,
  supervisor_id   uuid not null references supervisors(id) on delete restrict,
  promoter_id     uuid references promoters(id) on delete restrict,
  item_id         uuid not null references items(id) on delete restrict,
  qty             integer not null,                      -- signed: + into warehouse, - out of warehouse
  session_id      uuid references daily_sessions(id) on delete set null,
  movement_date   timestamptz not null default now(),
  notes           text,
  created_by      uuid references auth.users(id) on delete set null
);

create index if not exists stock_movements_supervisor_idx on stock_movements(supervisor_id);
create index if not exists stock_movements_item_idx       on stock_movements(item_id);
create index if not exists stock_movements_session_idx    on stock_movements(session_id);
create index if not exists stock_movements_date_idx       on stock_movements(movement_date);
create index if not exists stock_movements_type_idx       on stock_movements(movement_type);

-- =====================================================================
-- USER PROFILES (linked to Supabase Auth)
-- =====================================================================
create table if not exists user_profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  full_name             text not null,
  role                  user_role not null default 'viewer',
  linked_supervisor_id  uuid references supervisors(id) on delete set null,
  linked_team_id        uuid references teams(id)       on delete set null,
  active                boolean not null default true,
  created_at            timestamptz not null default now()
);

create index if not exists user_profiles_role_idx       on user_profiles(role);
create index if not exists user_profiles_supervisor_idx on user_profiles(linked_supervisor_id);
create index if not exists user_profiles_team_idx       on user_profiles(linked_team_id);

-- Supervisor-role profiles must be linked to a supervisor + team
alter table user_profiles
  drop constraint if exists user_profiles_supervisor_link_required;
alter table user_profiles
  add constraint user_profiles_supervisor_link_required
  check (
    role <> 'supervisor'
    or (linked_supervisor_id is not null and linked_team_id is not null)
  );

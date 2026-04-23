-- =====================================================================
-- Migration 005: Fix "permission denied for table" errors
-- =====================================================================
-- Root cause: The `authenticated` role (used by Supabase for all logged-in
-- users) had no GRANT on the public schema tables. RLS policies are
-- evaluated only AFTER the role passes the GRANT check, so the policy
-- never even ran.
--
-- This migration:
--   1. Grants USAGE on schema public to anon + authenticated
--   2. Grants table privileges to authenticated (and SELECT to anon)
--   3. Grants sequence usage so DEFAULT gen_random_uuid() etc. work
--   4. Grants EXECUTE on functions (for our RPCs and helpers)
--   5. Sets default privileges so future tables/functions inherit grants
--   6. Re-asserts the daily_sessions policies to be safe
-- =====================================================================

-- 1. Schema usage
grant usage on schema public to anon, authenticated;

-- 2. Table privileges (RLS still gates per-row access)
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;

-- 3. Sequences (needed for serial / identity columns; harmless for uuid)
grant usage, select on all sequences in schema public to anon, authenticated;

-- 4. Function execution
grant execute on all functions in schema public to anon, authenticated;

-- 5. Default privileges so future migrations don't have to repeat this
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;
alter default privileges in schema public
  grant execute on functions to anon, authenticated;

-- =====================================================================
-- 6. Re-assert daily_sessions policies (idempotent; in case earlier
--    migrations partially ran or got rolled back).
-- =====================================================================

drop policy if exists daily_sessions_read              on daily_sessions;
drop policy if exists daily_sessions_supervisor_insert on daily_sessions;
drop policy if exists daily_sessions_supervisor_update on daily_sessions;
drop policy if exists daily_sessions_admin_delete      on daily_sessions;

create policy daily_sessions_read on daily_sessions
  for select to authenticated
  using (
    current_user_role() in ('admin','viewer')
    or (current_user_role() = 'supervisor' and supervisor_id = current_user_supervisor())
  );

create policy daily_sessions_supervisor_insert on daily_sessions
  for insert to authenticated
  with check (
    current_user_role() = 'admin'
    or (current_user_role() = 'supervisor' and supervisor_id = current_user_supervisor())
  );

create policy daily_sessions_supervisor_update on daily_sessions
  for update to authenticated
  using (
    current_user_role() = 'admin'
    or (
      current_user_role() = 'supervisor'
      and supervisor_id = current_user_supervisor()
      and status <> 'closed'
    )
  )
  with check (
    current_user_role() = 'admin'
    or (current_user_role() = 'supervisor' and supervisor_id = current_user_supervisor())
  );

create policy daily_sessions_admin_delete on daily_sessions
  for delete to authenticated
  using (current_user_role() = 'admin');

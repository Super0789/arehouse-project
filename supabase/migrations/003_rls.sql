-- =====================================================================
-- Migration 003: Row Level Security
-- =====================================================================
-- Roles:
--   admin      -> full read/write everywhere
--   supervisor -> sees only their own team + supervisor + promoters + sessions
--   viewer     -> read-only across everything
-- =====================================================================

-- Enable RLS on all tables
alter table teams                 enable row level security;
alter table supervisors           enable row level security;
alter table promoters             enable row level security;
alter table items                 enable row level security;
alter table supervisor_stock      enable row level security;
alter table daily_sessions        enable row level security;
alter table morning_distribution  enable row level security;
alter table promoter_closing      enable row level security;
alter table stock_movements       enable row level security;
alter table user_profiles         enable row level security;

-- Drop any existing policies (idempotent re-runs)
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- user_profiles
-- ---------------------------------------------------------------------
create policy user_profiles_self_read on user_profiles
  for select to authenticated
  using (id = auth.uid() or current_user_role() in ('admin','viewer'));

create policy user_profiles_admin_write on user_profiles
  for all to authenticated
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

-- ---------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------
create policy teams_read on teams
  for select to authenticated
  using (
    current_user_role() in ('admin','viewer')
    or (current_user_role() = 'supervisor' and id = current_user_team())
  );

create policy teams_admin_write on teams
  for all to authenticated
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

-- ---------------------------------------------------------------------
-- supervisors
-- ---------------------------------------------------------------------
create policy supervisors_read on supervisors
  for select to authenticated
  using (
    current_user_role() in ('admin','viewer')
    or (current_user_role() = 'supervisor' and team_id = current_user_team())
  );

create policy supervisors_admin_write on supervisors
  for all to authenticated
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

-- ---------------------------------------------------------------------
-- promoters
-- ---------------------------------------------------------------------
create policy promoters_read on promoters
  for select to authenticated
  using (
    current_user_role() in ('admin','viewer')
    or (current_user_role() = 'supervisor' and team_id = current_user_team())
  );

create policy promoters_admin_write on promoters
  for all to authenticated
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

-- ---------------------------------------------------------------------
-- items (everyone reads, only admin writes)
-- ---------------------------------------------------------------------
create policy items_read on items
  for select to authenticated using (true);

create policy items_admin_write on items
  for all to authenticated
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

-- ---------------------------------------------------------------------
-- supervisor_stock (read-only for app; writes happen via trigger)
-- ---------------------------------------------------------------------
create policy supervisor_stock_read on supervisor_stock
  for select to authenticated
  using (
    current_user_role() in ('admin','viewer')
    or (current_user_role() = 'supervisor' and supervisor_id = current_user_supervisor())
  );

-- No insert/update/delete policies = nobody can write directly.
-- Writes happen only via the stock_movements trigger, which runs as the
-- calling user but bypasses RLS on supervisor_stock because the trigger
-- function runs in the owner's context (definer is the table owner).

-- ---------------------------------------------------------------------
-- daily_sessions
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- morning_distribution
-- ---------------------------------------------------------------------
create policy morning_distribution_read on morning_distribution
  for select to authenticated
  using (
    current_user_role() in ('admin','viewer')
    or exists (
      select 1 from daily_sessions s
      where s.id = morning_distribution.daily_session_id
        and s.supervisor_id = current_user_supervisor()
    )
  );

create policy morning_distribution_write on morning_distribution
  for all to authenticated
  using (
    current_user_role() = 'admin'
    or exists (
      select 1 from daily_sessions s
      where s.id = morning_distribution.daily_session_id
        and s.supervisor_id = current_user_supervisor()
        and s.status in ('draft','morning_submitted')
    )
  )
  with check (
    current_user_role() = 'admin'
    or exists (
      select 1 from daily_sessions s
      where s.id = morning_distribution.daily_session_id
        and s.supervisor_id = current_user_supervisor()
        and s.status in ('draft','morning_submitted')
    )
  );

-- ---------------------------------------------------------------------
-- promoter_closing
-- ---------------------------------------------------------------------
create policy promoter_closing_read on promoter_closing
  for select to authenticated
  using (
    current_user_role() in ('admin','viewer')
    or exists (
      select 1 from daily_sessions s
      where s.id = promoter_closing.daily_session_id
        and s.supervisor_id = current_user_supervisor()
    )
  );

create policy promoter_closing_write on promoter_closing
  for all to authenticated
  using (
    current_user_role() = 'admin'
    or exists (
      select 1 from daily_sessions s
      where s.id = promoter_closing.daily_session_id
        and s.supervisor_id = current_user_supervisor()
        and s.status = 'morning_submitted'
    )
  )
  with check (
    current_user_role() = 'admin'
    or exists (
      select 1 from daily_sessions s
      where s.id = promoter_closing.daily_session_id
        and s.supervisor_id = current_user_supervisor()
        and s.status = 'morning_submitted'
    )
  );

-- ---------------------------------------------------------------------
-- stock_movements
-- ---------------------------------------------------------------------
create policy stock_movements_read on stock_movements
  for select to authenticated
  using (
    current_user_role() in ('admin','viewer')
    or (current_user_role() = 'supervisor' and supervisor_id = current_user_supervisor())
  );

-- Direct inserts: admin can insert anything; supervisors can only insert
-- for their own supervisor_id (which happens when their distribution/closing
-- triggers fire as them). Viewers cannot insert.
create policy stock_movements_admin_insert on stock_movements
  for insert to authenticated
  with check (
    current_user_role() = 'admin'
    or (
      current_user_role() = 'supervisor'
      and supervisor_id = current_user_supervisor()
    )
  );

-- No update/delete policies — stock_movements is append-only.

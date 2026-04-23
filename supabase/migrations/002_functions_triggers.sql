-- =====================================================================
-- Migration 002: Functions, triggers, and RPCs
-- =====================================================================
-- Enforces business rules at the DB layer:
--   * supervisor_stock is maintained exclusively by the stock_movements trigger
--   * no negative stock after any movement
--   * no distribution > current stock
--   * no closing qty > morning qty
--   * session close auto-returns remaining qty to supervisor warehouse
--   * admin override RPC for the "one session per day" rule
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------

create or replace function current_user_role()
returns user_role
language sql stable security definer set search_path = public as $$
  select role from user_profiles where id = auth.uid();
$$;

create or replace function current_user_team()
returns uuid
language sql stable security definer set search_path = public as $$
  select linked_team_id from user_profiles where id = auth.uid();
$$;

create or replace function current_user_supervisor()
returns uuid
language sql stable security definer set search_path = public as $$
  select linked_supervisor_id from user_profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- Updated_at touch for supervisor_stock
-- ---------------------------------------------------------------------
create or replace function touch_supervisor_stock()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists supervisor_stock_touch on supervisor_stock;
create trigger supervisor_stock_touch
  before update on supervisor_stock
  for each row execute function touch_supervisor_stock();

-- ---------------------------------------------------------------------
-- Apply stock movement -> supervisor_stock
-- ---------------------------------------------------------------------
-- qty is signed in stock_movements:
--   opening_stock -> +qty  (into warehouse)
--   distributed   -> -qty  (out of warehouse, to promoter)
--   returned      -> +qty  (back into warehouse)
--   adjustment    -> +qty or -qty (admin-set)
--
-- We enforce the sign matches the movement type so app code can't
-- accidentally record a positive "distributed" row.
create or replace function apply_stock_movement()
returns trigger language plpgsql as $$
declare
  new_qty integer;
begin
  -- Sign check
  if tg_op = 'INSERT' then
    if new.movement_type = 'opening_stock' and new.qty <= 0 then
      raise exception 'opening_stock qty must be positive';
    elsif new.movement_type = 'distributed' and new.qty >= 0 then
      raise exception 'distributed qty must be negative (stock leaving warehouse)';
    elsif new.movement_type = 'returned' and new.qty <= 0 then
      raise exception 'returned qty must be positive (stock coming back)';
    elsif new.movement_type = 'adjustment' and new.qty = 0 then
      raise exception 'adjustment qty cannot be zero';
    end if;

    -- Upsert running balance
    insert into supervisor_stock (supervisor_id, item_id, quantity_on_hand)
    values (new.supervisor_id, new.item_id, new.qty)
    on conflict (supervisor_id, item_id) do update
      set quantity_on_hand = supervisor_stock.quantity_on_hand + excluded.quantity_on_hand
      returning quantity_on_hand into new_qty;

    if new_qty < 0 then
      raise exception 'Insufficient stock: supervisor % item % would go to %',
        new.supervisor_id, new.item_id, new_qty;
    end if;

    return new;
  end if;

  -- We don't support UPDATE / DELETE on stock_movements — audit trail is append-only
  raise exception 'stock_movements is append-only; use a new adjustment row instead';
end $$;

drop trigger if exists stock_movements_apply on stock_movements;
create trigger stock_movements_apply
  before insert on stock_movements
  for each row execute function apply_stock_movement();

-- Block UPDATE/DELETE at trigger level as well (defense in depth)
create or replace function stock_movements_block_mutations()
returns trigger language plpgsql as $$
begin
  raise exception 'stock_movements is append-only';
end $$;

drop trigger if exists stock_movements_no_update on stock_movements;
create trigger stock_movements_no_update
  before update or delete on stock_movements
  for each row execute function stock_movements_block_mutations();

-- ---------------------------------------------------------------------
-- Validate morning distribution row
-- ---------------------------------------------------------------------
-- Ensure promoter belongs to the session's team and stock is sufficient.
create or replace function validate_morning_distribution()
returns trigger language plpgsql as $$
declare
  s_team   uuid;
  s_super  uuid;
  s_status session_status;
  p_team   uuid;
  on_hand  integer;
  old_qty  integer := 0;
  delta    integer;
begin
  select team_id, supervisor_id, status
    into s_team, s_super, s_status
    from daily_sessions where id = new.daily_session_id;

  if s_status = 'closed' then
    raise exception 'Cannot modify a closed session';
  end if;

  select team_id into p_team from promoters where id = new.promoter_id;
  if p_team is distinct from s_team then
    raise exception 'Promoter does not belong to this session''s team';
  end if;

  if tg_op = 'UPDATE' then old_qty := old.qty_given; end if;
  delta := new.qty_given - old_qty;

  if delta <> 0 then
    select quantity_on_hand into on_hand
      from supervisor_stock
     where supervisor_id = s_super and item_id = new.item_id;

    if on_hand is null then on_hand := 0; end if;

    if delta > on_hand then
      raise exception 'Insufficient stock for item %: need %, have %',
        new.item_id, delta, on_hand;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists morning_distribution_validate on morning_distribution;
create trigger morning_distribution_validate
  before insert or update on morning_distribution
  for each row execute function validate_morning_distribution();

-- Record stock movement when distribution is saved.
-- For UPDATE we record the delta so the running balance stays correct.
-- Positive delta (more given)  -> 'distributed' with qty = -delta (stock out)
-- Negative delta (taking back) -> 'returned'    with qty = -delta (stock back in; -delta is positive)
create or replace function record_morning_distribution_movement()
returns trigger language plpgsql as $$
declare
  s_super uuid;
  delta   integer;
  m_note  text;
begin
  select supervisor_id into s_super from daily_sessions where id = new.daily_session_id;

  if tg_op = 'INSERT' then
    delta := new.qty_given;
  else
    delta := new.qty_given - old.qty_given;
  end if;

  if delta = 0 then return new; end if;

  m_note := case when tg_op = 'UPDATE' then 'distribution edited' else 'morning distribution' end;

  if delta > 0 then
    insert into stock_movements (
      movement_type, supervisor_id, promoter_id, item_id, qty, session_id, notes, created_by
    ) values (
      'distributed', s_super, new.promoter_id, new.item_id, -delta, new.daily_session_id,
      m_note, new.created_by
    );
  else
    insert into stock_movements (
      movement_type, supervisor_id, promoter_id, item_id, qty, session_id, notes, created_by
    ) values (
      'returned', s_super, new.promoter_id, new.item_id, -delta, new.daily_session_id,
      m_note, new.created_by
    );
  end if;
  return new;
end $$;

drop trigger if exists morning_distribution_movement on morning_distribution;
create trigger morning_distribution_movement
  after insert or update on morning_distribution
  for each row execute function record_morning_distribution_movement();

-- If a distribution row is deleted before session close, reverse the stock move
create or replace function reverse_morning_distribution_movement()
returns trigger language plpgsql as $$
declare
  s_super  uuid;
  s_status session_status;
begin
  select supervisor_id, status
    into s_super, s_status
    from daily_sessions where id = old.daily_session_id;

  if s_status = 'closed' then
    raise exception 'Cannot delete distribution from a closed session';
  end if;

  if old.qty_given > 0 then
    insert into stock_movements (
      movement_type, supervisor_id, promoter_id, item_id, qty, session_id, notes, created_by
    ) values (
      'returned', s_super, old.promoter_id, old.item_id, old.qty_given, old.daily_session_id,
      'distribution row deleted', old.created_by
    );
  end if;
  return old;
end $$;

drop trigger if exists morning_distribution_reverse on morning_distribution;
create trigger morning_distribution_reverse
  before delete on morning_distribution
  for each row execute function reverse_morning_distribution_movement();

-- ---------------------------------------------------------------------
-- Validate promoter closing row
-- ---------------------------------------------------------------------
create or replace function validate_promoter_closing()
returns trigger language plpgsql as $$
declare
  given    integer;
  s_status session_status;
begin
  select status into s_status from daily_sessions where id = new.daily_session_id;
  if s_status = 'closed' then
    raise exception 'Cannot modify a closed session';
  end if;
  if s_status = 'draft' then
    raise exception 'Cannot enter closing data before morning distribution is submitted';
  end if;

  select coalesce(qty_given, 0) into given
    from morning_distribution
   where daily_session_id = new.daily_session_id
     and promoter_id      = new.promoter_id
     and item_id          = new.item_id;

  if given is null then given := 0; end if;

  if new.qty_remaining > given then
    raise exception 'Remaining (%) cannot exceed given (%)', new.qty_remaining, given;
  end if;

  return new;
end $$;

drop trigger if exists promoter_closing_validate on promoter_closing;
create trigger promoter_closing_validate
  before insert or update on promoter_closing
  for each row execute function validate_promoter_closing();

-- ---------------------------------------------------------------------
-- RPC: submit morning (flip status: draft -> morning_submitted)
-- ---------------------------------------------------------------------
create or replace function submit_morning(p_session_id uuid)
returns daily_sessions
language plpgsql security definer set search_path = public as $$
declare
  sess daily_sessions;
  role user_role;
  uid  uuid := auth.uid();
begin
  role := current_user_role();
  select * into sess from daily_sessions where id = p_session_id;
  if not found then raise exception 'Session not found'; end if;

  if role = 'supervisor' and sess.supervisor_id <> current_user_supervisor() then
    raise exception 'Not authorized for this session';
  end if;
  if role = 'viewer' then raise exception 'Viewers cannot submit'; end if;

  if sess.status <> 'draft' then
    raise exception 'Session is not in draft status';
  end if;

  if not exists (
    select 1 from morning_distribution where daily_session_id = p_session_id and qty_given > 0
  ) then
    raise exception 'At least one distribution line is required';
  end if;

  update daily_sessions
     set status = 'morning_submitted',
         morning_submitted_at = now()
   where id = p_session_id
  returning * into sess;
  return sess;
end $$;

-- ---------------------------------------------------------------------
-- RPC: close session
--   * requires closing row for every (promoter, item) that received > 0
--   * auto-returns remaining qty to supervisor warehouse
--   * locks session
-- ---------------------------------------------------------------------
create or replace function close_session(p_session_id uuid)
returns daily_sessions
language plpgsql security definer set search_path = public as $$
declare
  sess       daily_sessions;
  role       user_role;
  missing    integer;
  r          record;
begin
  role := current_user_role();
  select * into sess from daily_sessions where id = p_session_id for update;
  if not found then raise exception 'Session not found'; end if;

  if role = 'supervisor' and sess.supervisor_id <> current_user_supervisor() then
    raise exception 'Not authorized for this session';
  end if;
  if role = 'viewer' then raise exception 'Viewers cannot close sessions'; end if;

  if sess.status = 'closed' then raise exception 'Session already closed'; end if;
  if sess.status = 'draft'  then raise exception 'Submit morning first'; end if;

  -- Every promoter-item that received > 0 must have a closing row
  select count(*) into missing
    from morning_distribution md
    left join promoter_closing pc
      on pc.daily_session_id = md.daily_session_id
     and pc.promoter_id      = md.promoter_id
     and pc.item_id          = md.item_id
   where md.daily_session_id = p_session_id
     and md.qty_given > 0
     and pc.id is null;

  if missing > 0 then
    raise exception 'Missing closing entries for % distribution line(s)', missing;
  end if;

  -- Auto-return remaining qty to supervisor warehouse
  for r in
    select pc.promoter_id, pc.item_id, pc.qty_remaining
      from promoter_closing pc
     where pc.daily_session_id = p_session_id
       and pc.qty_remaining > 0
  loop
    insert into stock_movements (
      movement_type, supervisor_id, promoter_id, item_id, qty, session_id, notes, created_by
    ) values (
      'returned', sess.supervisor_id, r.promoter_id, r.item_id, r.qty_remaining,
      p_session_id, 'auto-return on session close', auth.uid()
    );
  end loop;

  update daily_sessions
     set status = 'closed', closed_at = now()
   where id = p_session_id
  returning * into sess;

  return sess;
end $$;

-- ---------------------------------------------------------------------
-- RPC: admin reopens a closed session (override)
-- Reverses the auto-return movements so stock is consistent again.
-- ---------------------------------------------------------------------
create or replace function admin_reopen_session(p_session_id uuid)
returns daily_sessions
language plpgsql security definer set search_path = public as $$
declare
  sess daily_sessions;
  r    record;
begin
  if current_user_role() <> 'admin' then
    raise exception 'Only admins can reopen sessions';
  end if;

  select * into sess from daily_sessions where id = p_session_id for update;
  if not found then raise exception 'Session not found'; end if;
  if sess.status <> 'closed' then raise exception 'Session is not closed'; end if;

  -- Reverse all auto-return movements tied to this session
  for r in
    select promoter_id, item_id, qty
      from stock_movements
     where session_id = p_session_id
       and movement_type = 'returned'
       and notes = 'auto-return on session close'
  loop
    insert into stock_movements (
      movement_type, supervisor_id, promoter_id, item_id, qty, session_id, notes, created_by
    ) values (
      'distributed', sess.supervisor_id, r.promoter_id, r.item_id, -r.qty,
      p_session_id, 'reversal of auto-return (admin reopen)', auth.uid()
    );
  end loop;

  update daily_sessions
     set status = 'morning_submitted', closed_at = null
   where id = p_session_id
  returning * into sess;
  return sess;
end $$;

-- ---------------------------------------------------------------------
-- RPC: admin opens an additional session for a supervisor on a date
-- The unique (supervisor_id, session_date) constraint would block this,
-- so admin override is implemented by bumping the existing session's
-- date into a past placeholder. Simpler approach: we DISALLOW a second
-- session and instead require admin to reopen+edit the existing one.
-- Kept as a thin wrapper for future flexibility.
-- ---------------------------------------------------------------------
create or replace function admin_adjust_stock(
  p_supervisor_id uuid,
  p_item_id       uuid,
  p_qty           integer,
  p_reason        text
) returns stock_movements
language plpgsql security definer set search_path = public as $$
declare
  mv stock_movements;
begin
  if current_user_role() <> 'admin' then
    raise exception 'Only admins can adjust stock';
  end if;
  if p_qty = 0 then raise exception 'Adjustment qty cannot be zero'; end if;
  if coalesce(p_reason, '') = '' then raise exception 'Reason is required'; end if;

  insert into stock_movements (
    movement_type, supervisor_id, item_id, qty, notes, created_by
  ) values (
    'adjustment', p_supervisor_id, p_item_id, p_qty, p_reason, auth.uid()
  ) returning * into mv;
  return mv;
end $$;

create or replace function admin_add_opening_stock(
  p_supervisor_id uuid,
  p_item_id       uuid,
  p_qty           integer,
  p_notes         text default null
) returns stock_movements
language plpgsql security definer set search_path = public as $$
declare
  mv stock_movements;
begin
  if current_user_role() <> 'admin' then
    raise exception 'Only admins can add opening stock';
  end if;
  if p_qty <= 0 then raise exception 'Opening stock qty must be positive'; end if;

  insert into stock_movements (
    movement_type, supervisor_id, item_id, qty, notes, created_by
  ) values (
    'opening_stock', p_supervisor_id, p_item_id, p_qty, p_notes, auth.uid()
  ) returning * into mv;
  return mv;
end $$;

-- ---------------------------------------------------------------------
-- Auto-create user_profiles on signup
-- ---------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into user_profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'viewer'   -- admin promotes after signup
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

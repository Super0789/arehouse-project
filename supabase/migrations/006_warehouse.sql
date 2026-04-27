-- =====================================================================
-- Migration 006: Main warehouse (مخزن رئيسي)
-- =====================================================================
-- Adds a central warehouse layer that sits above supervisor stocks.
-- Admin receives shipments INTO the warehouse, then transfers stock
-- OUT of the warehouse INTO a supervisor's balance. The transfer
-- atomically debits the warehouse and credits the supervisor.
-- =====================================================================

-- New movement types for the warehouse audit trail.
do $$ begin
  create type warehouse_movement_type as enum (
    'received',       -- shipment in from supplier (positive qty)
    'transfer_out',   -- moved to a supervisor (negative qty)
    'adjustment'      -- admin correction (signed)
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- warehouse_stock: running balance per item (one row per item)
-- ---------------------------------------------------------------------
create table if not exists warehouse_stock (
  id                uuid primary key default gen_random_uuid(),
  item_id           uuid not null references items(id) on delete cascade,
  quantity_on_hand  integer not null default 0 check (quantity_on_hand >= 0),
  updated_at        timestamptz not null default now(),
  unique (item_id)
);

create index if not exists warehouse_stock_item_idx on warehouse_stock(item_id);

-- ---------------------------------------------------------------------
-- warehouse_movements: append-only audit trail
-- ---------------------------------------------------------------------
create table if not exists warehouse_movements (
  id              uuid primary key default gen_random_uuid(),
  movement_type   warehouse_movement_type not null,
  item_id         uuid not null references items(id)        on delete restrict,
  qty             integer not null,                          -- signed
  -- Optional link to a supervisor when this movement is a transfer out
  supervisor_id   uuid references supervisors(id) on delete set null,
  -- Optional link to the corresponding supervisor-side movement
  related_stock_movement_id uuid references stock_movements(id) on delete set null,
  movement_date   timestamptz not null default now(),
  notes           text,
  created_by      uuid references auth.users(id) on delete set null
);

create index if not exists warehouse_movements_item_idx       on warehouse_movements(item_id);
create index if not exists warehouse_movements_supervisor_idx on warehouse_movements(supervisor_id);
create index if not exists warehouse_movements_date_idx       on warehouse_movements(movement_date);
create index if not exists warehouse_movements_type_idx       on warehouse_movements(movement_type);

-- ---------------------------------------------------------------------
-- Touch updated_at on warehouse_stock
-- ---------------------------------------------------------------------
create or replace function touch_warehouse_stock()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists warehouse_stock_touch on warehouse_stock;
create trigger warehouse_stock_touch
  before update on warehouse_stock
  for each row execute function touch_warehouse_stock();

-- ---------------------------------------------------------------------
-- Apply warehouse movement -> warehouse_stock
-- ---------------------------------------------------------------------
-- Sign rules:
--   received     -> +qty
--   transfer_out -> -qty
--   adjustment   -> ±qty (cannot be zero)
create or replace function apply_warehouse_movement()
returns trigger language plpgsql as $$
declare
  new_qty integer;
begin
  if tg_op = 'INSERT' then
    if new.movement_type = 'received' and new.qty <= 0 then
      raise exception 'received qty must be positive';
    elsif new.movement_type = 'transfer_out' and new.qty >= 0 then
      raise exception 'transfer_out qty must be negative';
    elsif new.movement_type = 'adjustment' and new.qty = 0 then
      raise exception 'adjustment qty cannot be zero';
    end if;

    insert into warehouse_stock (item_id, quantity_on_hand)
    values (new.item_id, new.qty)
    on conflict (item_id) do update
      set quantity_on_hand = warehouse_stock.quantity_on_hand + excluded.quantity_on_hand
      returning quantity_on_hand into new_qty;

    if new_qty < 0 then
      raise exception 'Insufficient warehouse stock for item %: would go to %',
        new.item_id, new_qty;
    end if;

    return new;
  end if;

  raise exception 'warehouse_movements is append-only';
end $$;

drop trigger if exists warehouse_movements_apply on warehouse_movements;
create trigger warehouse_movements_apply
  before insert on warehouse_movements
  for each row execute function apply_warehouse_movement();

create or replace function warehouse_movements_block_mutations()
returns trigger language plpgsql as $$
begin
  raise exception 'warehouse_movements is append-only';
end $$;

drop trigger if exists warehouse_movements_no_update on warehouse_movements;
create trigger warehouse_movements_no_update
  before update or delete on warehouse_movements
  for each row execute function warehouse_movements_block_mutations();

-- ---------------------------------------------------------------------
-- RPC: admin adds stock to the main warehouse (incoming shipment)
-- ---------------------------------------------------------------------
create or replace function admin_warehouse_receive(
  p_item_id uuid,
  p_qty     integer,
  p_notes   text default null
) returns warehouse_movements
language plpgsql security definer set search_path = public as $$
declare
  mv warehouse_movements;
begin
  if current_user_role() <> 'admin' then
    raise exception 'Only admins can add to warehouse';
  end if;
  if p_qty <= 0 then raise exception 'Qty must be positive'; end if;

  insert into warehouse_movements (
    movement_type, item_id, qty, notes, created_by
  ) values (
    'received', p_item_id, p_qty, p_notes, auth.uid()
  ) returning * into mv;
  return mv;
end $$;

-- ---------------------------------------------------------------------
-- RPC: admin adjusts the warehouse (signed correction with reason)
-- ---------------------------------------------------------------------
create or replace function admin_warehouse_adjust(
  p_item_id uuid,
  p_qty     integer,
  p_reason  text
) returns warehouse_movements
language plpgsql security definer set search_path = public as $$
declare
  mv warehouse_movements;
begin
  if current_user_role() <> 'admin' then
    raise exception 'Only admins can adjust warehouse';
  end if;
  if p_qty = 0 then raise exception 'Adjustment qty cannot be zero'; end if;
  if coalesce(p_reason, '') = '' then raise exception 'Reason is required'; end if;

  insert into warehouse_movements (
    movement_type, item_id, qty, notes, created_by
  ) values (
    'adjustment', p_item_id, p_qty, p_reason, auth.uid()
  ) returning * into mv;
  return mv;
end $$;

-- ---------------------------------------------------------------------
-- Replace admin_add_opening_stock so it ALSO debits the main warehouse
-- ---------------------------------------------------------------------
-- The transfer is atomic: if the warehouse cannot cover the qty, the
-- whole transaction aborts and nothing is written. The supervisor-side
-- stock_movement and the warehouse-side warehouse_movement are linked
-- both ways for audit traceability.
create or replace function admin_add_opening_stock(
  p_supervisor_id uuid,
  p_item_id       uuid,
  p_qty           integer,
  p_notes         text default null
) returns stock_movements
language plpgsql security definer set search_path = public as $$
declare
  mv  stock_movements;
  wmv warehouse_movements;
  wh_qty integer;
begin
  if current_user_role() <> 'admin' then
    raise exception 'Only admins can add opening stock';
  end if;
  if p_qty <= 0 then raise exception 'Opening stock qty must be positive'; end if;

  -- Lock the warehouse row for this item and verify availability
  select coalesce(quantity_on_hand, 0) into wh_qty
    from warehouse_stock
   where item_id = p_item_id
   for update;
  wh_qty := coalesce(wh_qty, 0);

  if p_qty > wh_qty then
    raise exception 'الكمية المطلوبة (%) تتجاوز رصيد المخزن الرئيسي (%)',
      p_qty, wh_qty
      using errcode = 'P0001';
  end if;

  -- Credit the supervisor first (gets the stock_movement id)
  insert into stock_movements (
    movement_type, supervisor_id, item_id, qty, notes, created_by
  ) values (
    'opening_stock', p_supervisor_id, p_item_id, p_qty, p_notes, auth.uid()
  ) returning * into mv;

  -- Debit the warehouse, linking back to the supervisor movement
  insert into warehouse_movements (
    movement_type, item_id, qty, supervisor_id,
    related_stock_movement_id, notes, created_by
  ) values (
    'transfer_out', p_item_id, -p_qty, p_supervisor_id,
    mv.id, coalesce(p_notes, 'تحويل إلى مشرف'), auth.uid()
  ) returning * into wmv;

  return mv;
end $$;

-- ---------------------------------------------------------------------
-- RLS for warehouse tables
-- ---------------------------------------------------------------------
alter table warehouse_stock     enable row level security;
alter table warehouse_movements enable row level security;

drop policy if exists warehouse_stock_read     on warehouse_stock;
drop policy if exists warehouse_movements_read on warehouse_movements;
drop policy if exists warehouse_movements_admin_insert on warehouse_movements;

-- Admins and viewers can see warehouse balances; supervisors cannot.
create policy warehouse_stock_read on warehouse_stock
  for select to authenticated
  using (current_user_role() in ('admin','viewer'));

create policy warehouse_movements_read on warehouse_movements
  for select to authenticated
  using (current_user_role() in ('admin','viewer'));

-- Direct insert allowed for admin only; the RPCs above use SECURITY
-- DEFINER so they bypass this anyway, but defense in depth.
create policy warehouse_movements_admin_insert on warehouse_movements
  for insert to authenticated
  with check (current_user_role() = 'admin');

-- No update/delete policies — append-only.

-- ---------------------------------------------------------------------
-- Grants (defaults from migration 005 cover new tables, but be explicit)
-- ---------------------------------------------------------------------
grant select, insert on warehouse_stock     to authenticated;
grant select, insert on warehouse_movements to authenticated;
grant execute on function admin_warehouse_receive(uuid, integer, text) to authenticated;
grant execute on function admin_warehouse_adjust(uuid, integer, text)  to authenticated;
grant execute on function admin_add_opening_stock(uuid, uuid, integer, text) to authenticated;

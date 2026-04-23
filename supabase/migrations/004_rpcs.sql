-- =====================================================================
-- Migration 004: RPCs for session workflow
-- =====================================================================

-- ---------------------------------------------------------------------
-- submit_morning_distribution
-- ---------------------------------------------------------------------
-- Atomically:
--   1. Verifies session belongs to the caller (or caller is admin)
--   2. Verifies session is in 'draft' status
--   3. Validates each line against current supervisor_stock
--   4. Replaces all morning_distribution rows for this session
--   5. Inserts corresponding stock_movements (qty is NEGATIVE — out of warehouse)
--   6. Sets session status to 'morning_submitted'
--
-- Payload shape (jsonb array):
-- [ { "promoter_id": "uuid", "item_id": "uuid", "qty_given": 5 }, ... ]
-- Zero-qty rows are ignored.
-- =====================================================================
create or replace function submit_morning_distribution(
  p_session_id uuid,
  p_lines      jsonb
)
returns daily_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session   daily_sessions%rowtype;
  v_role      user_role;
  v_my_super  uuid;
  v_line      jsonb;
  v_item_id   uuid;
  v_promoter  uuid;
  v_qty       integer;
  v_stock     integer;
  v_needed    jsonb;
  v_need_rec  record;
begin
  -- Who am I?
  v_role := current_user_role();
  v_my_super := current_user_supervisor();

  -- Load session
  select * into v_session from daily_sessions where id = p_session_id;
  if not found then
    raise exception 'الجلسة غير موجودة' using errcode = 'P0002';
  end if;

  -- Authorization
  if v_role = 'supervisor' and v_session.supervisor_id <> v_my_super then
    raise exception 'غير مصرّح لك بتعديل هذه الجلسة' using errcode = '42501';
  end if;
  if v_role not in ('admin','supervisor') then
    raise exception 'غير مصرّح' using errcode = '42501';
  end if;

  -- Status gate
  if v_session.status <> 'draft' then
    raise exception 'لا يمكن تعديل التوزيع بعد إرساله' using errcode = 'P0001';
  end if;

  -- Filter out zero/negative rows and aggregate by item
  with clean as (
    select
      (el->>'promoter_id')::uuid as promoter_id,
      (el->>'item_id')::uuid     as item_id,
      (el->>'qty_given')::int    as qty_given
    from jsonb_array_elements(p_lines) el
  ),
  filtered as (
    select * from clean where qty_given > 0
  ),
  totals as (
    select item_id, sum(qty_given)::int as total_needed
    from filtered
    group by item_id
  )
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    into v_needed
    from totals t;

  -- Validate: for each item, total_needed <= supervisor_stock
  for v_need_rec in
    select * from jsonb_to_recordset(v_needed) as x(item_id uuid, total_needed int)
  loop
    select coalesce(quantity_on_hand, 0) into v_stock
      from supervisor_stock
     where supervisor_id = v_session.supervisor_id
       and item_id = v_need_rec.item_id;
    v_stock := coalesce(v_stock, 0);

    if v_need_rec.total_needed > v_stock then
      raise exception
        'الكمية المطلوبة (%) تتجاوز المخزون المتوفر (%) لأحد الأصناف',
        v_need_rec.total_needed, v_stock
        using errcode = 'P0001';
    end if;
  end loop;

  -- Wipe previous draft distribution rows and stock movements for this session
  delete from morning_distribution where daily_session_id = p_session_id;
  delete from stock_movements
        where session_id = p_session_id
          and movement_type = 'distributed';

  -- Insert new distribution rows
  insert into morning_distribution (
    daily_session_id, promoter_id, item_id, qty_given, created_by
  )
  select
    p_session_id,
    (el->>'promoter_id')::uuid,
    (el->>'item_id')::uuid,
    (el->>'qty_given')::int,
    auth.uid()
  from jsonb_array_elements(p_lines) el
  where (el->>'qty_given')::int > 0;

  -- Insert stock movements (NEGATIVE qty = out of supervisor warehouse)
  insert into stock_movements (
    movement_type, supervisor_id, promoter_id, item_id, qty,
    session_id, notes, created_by
  )
  select
    'distributed',
    v_session.supervisor_id,
    (el->>'promoter_id')::uuid,
    (el->>'item_id')::uuid,
    -((el->>'qty_given')::int),
    p_session_id,
    'توزيع الصباح',
    auth.uid()
  from jsonb_array_elements(p_lines) el
  where (el->>'qty_given')::int > 0;

  -- Flip status
  update daily_sessions
     set status = 'morning_submitted',
         morning_submitted_at = now()
   where id = p_session_id
  returning * into v_session;

  return v_session;
end;
$$;

grant execute on function submit_morning_distribution(uuid, jsonb) to authenticated;
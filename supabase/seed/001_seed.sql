-- =====================================================================
-- Seed data for development/testing
-- =====================================================================
-- Creates: 9 teams, 9 supervisors, 36 promoters, 7 items, starting stock.
--
-- User accounts (admin@test.com / supervisor@test.com / viewer@test.com)
-- must be created via the Supabase dashboard (Auth > Users), then run
-- the UPDATE statements at the bottom of this file to link them.
-- =====================================================================

-- -------- Teams --------
insert into teams (team_name, area) values
  ('فريق رام الله',   'رام الله والبيرة'),
  ('فريق الخليل',      'الخليل'),
  ('فريق نابلس',       'نابلس'),
  ('فريق بيت لحم',     'بيت لحم'),
  ('فريق جنين',        'جنين'),
  ('فريق طولكرم',     'طولكرم'),
  ('فريق قلقيلية',     'قلقيلية'),
  ('فريق أريحا',       'أريحا'),
  ('فريق سلفيت',      'سلفيت')
on conflict (team_name) do nothing;

-- -------- Supervisors (one per team, real names from current system) --------
insert into supervisors (full_name, team_id)
select v.full_name, t.id
from (values
  ('عماد بانا',        'فريق رام الله'),
  ('احمد حرب',         'فريق الخليل'),
  ('يزيد ملحم',        'فريق نابلس'),
  ('تامر حجوج',        'فريق بيت لحم'),
  ('محمد ملش',          'فريق جنين'),
  ('شاكر رستم',         'فريق طولكرم'),
  ('تحسين الاشهب',     'فريق قلقيلية'),
  ('عامر عبد ربه',      'فريق أريحا'),
  ('جاد الله صلاح',     'فريق سلفيت')
) as v(full_name, team_name)
join teams t on t.team_name = v.team_name
on conflict do nothing;

-- -------- Promoters (4 per team) --------
insert into promoters (full_name, team_id, supervisor_id)
select
  'المروج ' || gs || ' - ' || s.full_name,
  s.team_id,
  s.id
from supervisors s
cross join generate_series(1, 4) as gs
on conflict do nothing;

-- -------- Items --------
insert into items (item_name, item_code, category, unit) values
  ('Bluetooth Speaker',     'BT-SPK',   'Electronics',  'pcs'),
  ('DJEEP Lighter',         'DJEEP',    'Accessories',  'pcs'),
  ('Headphone',             'HPH',      'Electronics',  'pcs'),
  ('Phone Holder',          'PH-HOLD',  'Accessories',  'pcs'),
  ('Car Magnet Holder',     'CAR-MAG',  'Accessories',  'pcs'),
  ('Metal Winston Ashtrays','ASH-WIN',  'Accessories',  'pcs'),
  ('Power Bank',            'PWR-BNK',  'Electronics',  'pcs')
on conflict (item_code) do nothing;

-- -------- Opening stock --------
-- Every supervisor starts with the same baseline.
-- We insert directly into stock_movements so the trigger maintains supervisor_stock.
-- Note: this bypasses the admin_add_opening_stock RPC because there is no
-- authenticated user during seeding — the sign-check in the trigger still runs.
do $$
declare
  s record;
  i record;
  qty integer;
begin
  for s in select id from supervisors loop
    for i in select id, item_code from items loop
      qty := case i.item_code
        when 'DJEEP'    then 400
        when 'BT-SPK'   then 30
        when 'HPH'      then 60
        when 'PH-HOLD'  then 50
        when 'CAR-MAG'  then 40
        when 'ASH-WIN'  then 35
        when 'PWR-BNK'  then 20
        else 25
      end;
      insert into stock_movements (
        movement_type, supervisor_id, item_id, qty, notes
      ) values (
        'opening_stock', s.id, i.id, qty, 'seed: initial stock'
      );
    end loop;
  end loop;
end $$;

-- =====================================================================
-- After creating auth users in the Supabase dashboard, run this:
-- =====================================================================
-- Replace the UUIDs below with the real auth.users.id values.
--
-- -- Admin
-- update user_profiles
--    set full_name = 'Admin User', role = 'admin'
--  where id = '<admin-user-uuid>';
--
-- -- Supervisor linked to Imad Bana / Ramallah team
-- update user_profiles
--    set full_name = 'عماد بانا',
--        role = 'supervisor',
--        linked_supervisor_id = (select id from supervisors where full_name = 'عماد بانا'),
--        linked_team_id       = (select id from teams       where team_name = 'فريق رام الله')
--  where id = '<supervisor-user-uuid>';
--
-- -- Viewer
-- update user_profiles
--    set full_name = 'Viewer User', role = 'viewer'
--  where id = '<viewer-user-uuid>';

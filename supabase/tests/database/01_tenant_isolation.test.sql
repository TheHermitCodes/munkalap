-- Tenant isolation: nothing from Org B is visible to, or writable by, Org A.
--
-- Run with `supabase test db`. Each file runs in a transaction that is rolled
-- back, so fixtures never leak into the dev database.
--
-- To act as a user we do what PostgREST does: put the JWT claims in
-- request.jwt.claims and switch to the `authenticated` role.

begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- Fixtures (as postgres, bypassing RLS) ---------------------------------------
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'anna@test.local',  now(), '{"full_name": "Anna"}'),
  ('22222222-2222-2222-2222-222222222222', 'bence@test.local', now(), '{"full_name": "Bence"}'),
  ('33333333-3333-3333-3333-333333333333', 'dora@test.local',  now(), '{"full_name": "Dóra"}');

insert into public.organizations (id, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Org A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Org B');

insert into public.memberships (org_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'member'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'owner');

insert into public.customers (id, org_id, name) values
  ('ca000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Customer A'),
  ('cb000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Customer B');

insert into public.work_orders (id, org_id, title, customer_id) values
  ('da000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Fix brakes', 'ca000000-0000-0000-0000-000000000001'),
  ('db000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Fix boiler', 'cb000000-0000-0000-0000-000000000001');

insert into storage.objects (bucket_id, name, owner_id) values
  ('attachments', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/da000000-0000-0000-0000-000000000001/a.pdf', '11111111-1111-1111-1111-111111111111'),
  ('attachments', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/db000000-0000-0000-0000-000000000001/b.pdf', '33333333-3333-3333-3333-333333333333');

-- Reads, as Bence (member of Org A) -------------------------------------------
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
set local role authenticated;

select results_eq(
  'select name from public.organizations',
  $$values ('Org A'::text)$$,
  'Members see only their own organizations'
);
select results_eq(
  'select title from public.work_orders',
  $$values ('Fix brakes'::text)$$,
  'Members see only their organization''s work orders'
);
select results_eq(
  'select name from public.customers',
  $$values ('Customer A'::text)$$,
  'Members see only their organization''s customers'
);
select is(
  (select count(*)::int from public.work_order_events where org_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  0,
  'Members can''t read another organization''s activity'
);
select is(
  (select count(*)::int from public.memberships),
  2,
  'Members see only their own organization''s memberships'
);
select results_eq(
  'select full_name from public.profiles order by full_name',
  $$values ('Anna'::text), ('Bence'::text)$$,
  'Profiles are visible to teammates only'
);

-- Writes across the tenant boundary --------------------------------------------
select throws_ok(
  $$insert into public.work_orders (org_id, title) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Sneaky')$$,
  '42501',
  'new row violates row-level security policy for table "work_orders"',
  'Members can''t create work orders in another organization'
);
select throws_ok(
  $$insert into public.work_orders (org_id, title, customer_id)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Wrong customer', 'cb000000-0000-0000-0000-000000000001')$$,
  '23503',
  null,
  'A work order can''t reference another organization''s customer'
);
select throws_ok(
  $$insert into public.work_orders (org_id, title, assignee_id)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Wrong assignee', '33333333-3333-3333-3333-333333333333')$$,
  '23503',
  null,
  'Work orders can only be assigned to members of the same organization'
);
select throws_ok(
  $$insert into public.work_order_events (org_id, work_order_id, type, body)
    values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'db000000-0000-0000-0000-000000000001', 'comment', 'Hi')$$,
  '42501',
  null,
  'Members can''t comment on another organization''s work orders'
);
select throws_ok(
  $$insert into public.work_order_events (org_id, work_order_id, type, body)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'db000000-0000-0000-0000-000000000001', 'comment', 'Hi')$$,
  '23503',
  null,
  '...not even by claiming their own org_id'
);

-- Storage paths ------------------------------------------------------------------
select results_eq(
  $$select name from storage.objects where bucket_id = 'attachments'$$,
  $$values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/da000000-0000-0000-0000-000000000001/a.pdf'::text)$$,
  'Members list only their organization''s attachments'
);
select ok(
  private.can_access_attachment('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/da000000-0000-0000-0000-000000000001/photo.jpg'),
  'Members can access attachment paths of their own work orders'
);
select ok(
  not private.can_access_attachment('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/db000000-0000-0000-0000-000000000001/photo.jpg'),
  '...but not another organization''s'
);
select ok(
  not private.can_access_attachment('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/db000000-0000-0000-0000-000000000001/photo.jpg'),
  'The org and work order in a path must belong together'
);
select ok(
  not private.can_access_attachment('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/not-a-uuid/photo.jpg'),
  'Malformed paths are denied instead of raising errors'
);
select ok(
  not private.can_access_attachment('photo.jpg'),
  'Paths without folders are denied'
);

-- Owner of Org A trying to touch Org B's data: affects nothing --------------------
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

update public.work_orders set title = 'Hijacked' where id = 'db000000-0000-0000-0000-000000000001';
delete from public.customers where id = 'cb000000-0000-0000-0000-000000000001';
delete from public.memberships where org_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

reset role;
select is(
  (select title from public.work_orders where id = 'db000000-0000-0000-0000-000000000001'),
  'Fix boiler',
  'Owners can''t update another organization''s work orders'
);
select is(
  (select count(*)::int from public.customers where id = 'cb000000-0000-0000-0000-000000000001'),
  1,
  'Owners can''t delete another organization''s customers'
);
select is(
  (select count(*)::int from public.memberships where org_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  1,
  'Owners can''t remove another organization''s members'
);

-- Anonymous visitors -----------------------------------------------------------------
set local request.jwt.claims to '{"role": "anon"}';
set local role anon;

select throws_ok(
  'select * from public.work_orders',
  '42501',
  null,
  'anon has no access to tenant tables'
);
select throws_ok(
  $$select public.create_organization('Spam Ltd')$$,
  '42501',
  null,
  'anon can''t call RPCs'
);

reset role;
select * from finish();
rollback;

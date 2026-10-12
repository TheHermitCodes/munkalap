-- Roles (owner vs member) and column-level privileges inside one organization.

begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Fixtures ------------------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'anna@test.local',  now(), '{"full_name": "Anna"}'),
  ('22222222-2222-2222-2222-222222222222', 'bence@test.local', now(), '{"full_name": "Bence"}');

insert into public.organizations (id, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Org A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Org B');

insert into public.memberships (org_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'member'),
  -- Bence is also an owner elsewhere, so "move it to my other org" is a real temptation.
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner');

insert into public.work_orders (id, org_id, title) values
  ('da000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Fix brakes');

insert into public.invitations (org_id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'someone@test.local');

-- As Bence (member of Org A) ----------------------------------------------------------
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
set local role authenticated;

select is(
  (select count(*)::int from public.invitations where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0,
  'Members can''t see invitations (they contain secret tokens)'
);
select throws_ok(
  $$insert into public.invitations (org_id, email) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'friend@test.local')$$,
  '42501',
  null,
  'Members can''t invite people'
);

-- Column privileges: RLS alone would allow these, since the rows are visible.
select throws_ok(
  $$update public.work_orders set org_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    where id = 'da000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'Work orders can''t be moved to another organization'
);
select throws_ok(
  $$insert into public.work_orders (org_id, title, number) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Mine', 1)$$,
  '42501',
  null,
  'Clients can''t choose work order numbers'
);
select throws_ok(
  $$update public.organizations set work_order_seq = 0$$,
  '42501',
  null,
  'The numbering counter isn''t client-writable'
);
select throws_ok(
  $$insert into public.work_order_events (org_id, work_order_id, type, body, actor_id)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'da000000-0000-0000-0000-000000000001', 'comment', 'Anna says hi',
            '11111111-1111-1111-1111-111111111111')$$,
  '42501',
  null,
  'Comments can''t be posted in someone else''s name'
);
select throws_ok(
  $$insert into public.work_order_events (org_id, work_order_id, type)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'da000000-0000-0000-0000-000000000001', 'status_changed')$$,
  '42501',
  null,
  'Clients can''t write system events'
);
select lives_ok(
  $$insert into public.work_order_events (org_id, work_order_id, type, body)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'da000000-0000-0000-0000-000000000001', 'comment', 'On it')$$,
  'Members can comment'
);
select is(
  (select actor_id from public.work_order_events where body = 'On it'),
  '22222222-2222-2222-2222-222222222222'::uuid,
  '...and the comment is attributed to them'
);
select throws_ok(
  $$update public.work_order_events set body = 'Edited'$$,
  '42501',
  null,
  'The activity log can''t be edited'
);
select throws_ok(
  $$delete from public.work_order_events$$,
  '42501',
  null,
  'The activity log can''t be deleted from'
);

-- Attachments: members delete only what they uploaded.
select ok(
  private.can_delete_attachment('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/da000000-0000-0000-0000-000000000001/mine.pdf',
                                '22222222-2222-2222-2222-222222222222'),
  'Members can delete attachments they uploaded'
);
select ok(
  not private.can_delete_attachment('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/da000000-0000-0000-0000-000000000001/annas.pdf',
                                    '11111111-1111-1111-1111-111111111111'),
  '...but not other people''s'
);

-- Silently filtered by RLS (0 rows affected); verified below as postgres.
delete from public.work_orders where id = 'da000000-0000-0000-0000-000000000001';
update public.memberships set role = 'owner'
  where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = '22222222-2222-2222-2222-222222222222';
update public.profiles set full_name = 'Hacked' where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set full_name = 'Bence T.' where id = '22222222-2222-2222-2222-222222222222';

reset role;
select is(
  (select count(*)::int from public.work_orders where id = 'da000000-0000-0000-0000-000000000001'),
  1,
  'Members can''t delete work orders'
);
select is(
  (select role from public.memberships
   where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = '22222222-2222-2222-2222-222222222222'),
  'member'::public.org_role,
  'Members can''t promote themselves'
);
select is(
  (select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Anna',
  'Users can''t edit other people''s profiles'
);
select is(
  (select full_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'Bence T.',
  'Users can edit their own profile'
);

-- As Anna (the only owner of Org A) ------------------------------------------------------
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
set local role authenticated;

select is(
  (select count(*)::int from public.invitations),
  1,
  'Owners see their organization''s invitations'
);
select ok(
  private.can_delete_attachment('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/da000000-0000-0000-0000-000000000001/bences.pdf',
                                '22222222-2222-2222-2222-222222222222'),
  'Owners can delete any attachment in their organization'
);
select throws_ok(
  $$delete from public.memberships
    where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = '11111111-1111-1111-1111-111111111111'$$,
  'P0001',
  'An organization needs at least one owner. Make someone else an owner first.',
  'The last owner can''t leave'
);
select throws_ok(
  $$update public.memberships set role = 'member'
    where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = '11111111-1111-1111-1111-111111111111'$$,
  'P0001',
  null,
  'The last owner can''t demote themselves'
);
select lives_ok(
  $$update public.memberships set role = 'owner'
    where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = '22222222-2222-2222-2222-222222222222'$$,
  'Owners can promote members'
);
select lives_ok(
  $$delete from public.memberships
    where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = '11111111-1111-1111-1111-111111111111'$$,
  'With another owner in place, the original owner can leave'
);

reset role;
select is(
  (select count(*)::int from public.memberships where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  '...and is gone'
);

select * from finish();
rollback;

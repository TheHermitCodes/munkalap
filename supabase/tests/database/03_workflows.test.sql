-- Business rules the database enforces: numbering, lifecycle, the activity log,
-- invitations, and what happens when people or customers go away.

begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Fixtures ------------------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'anna@test.local',  now(), '{"full_name": "Anna"}'),
  ('22222222-2222-2222-2222-222222222222', 'bence@test.local', now(), '{"full_name": "Bence"}'),
  ('33333333-3333-3333-3333-333333333333', 'dora@test.local',  now(), '{"full_name": "Dóra"}'),
  ('44444444-4444-4444-4444-444444444444', 'erik@test.local',  now(), '{"full_name": "Erik"}'),
  -- Signed up but never confirmed their email address.
  ('55555555-5555-5555-5555-555555555555', 'fanni@test.local', null,  '{"full_name": "Fanni"}');

insert into public.organizations (id, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Org A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Org B');

insert into public.memberships (org_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'member'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'owner');

insert into public.customers (id, org_id, name) values
  ('ca000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Customer A');

insert into public.work_orders (id, org_id, title, customer_id) values
  ('da000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Fix brakes', 'ca000000-0000-0000-0000-000000000001'),
  ('db000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Fix boiler', null);

insert into public.invitations (org_id, email, token, expires_at) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dora@test.local',  'f0000000-0000-0000-0000-000000000001', now() + interval '7 days'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'fanni@test.local', 'f0000000-0000-0000-0000-000000000002', now() + interval '7 days'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'erik@test.local',  'f0000000-0000-0000-0000-000000000003', now() - interval '1 day');

-- Creating an organization ---------------------------------------------------------------
set local request.jwt.claims to '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
set local role authenticated;

select lives_ok(
  $$select public.create_organization('  Erik''s Garage  ')$$,
  'Anyone signed in can create an organization'
);
select results_eq(
  $$select o.name, m.role::text from public.organizations o join public.memberships m on m.org_id = o.id$$,
  $$values ('Erik''s Garage'::text, 'owner'::text)$$,
  '...and becomes its owner (name trimmed)'
);

-- Numbering and lifecycle, as Anna --------------------------------------------------------
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

insert into public.work_orders (org_id, title) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Second'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Third');

select results_eq(
  $$select number from public.work_orders order by number$$,
  $$values (1), (2), (3)$$,
  'Work order numbers are sequential per organization'
);
select is(
  (select created_by from public.work_orders where title = 'Second'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'created_by is set from the session, not the client'
);

update public.work_orders set status = 'done' where id = 'da000000-0000-0000-0000-000000000001';
select isnt(
  (select closed_at from public.work_orders where id = 'da000000-0000-0000-0000-000000000001'),
  null,
  'Finishing a work order sets closed_at'
);
select results_eq(
  $$select type::text, payload from public.work_order_events
    where work_order_id = 'da000000-0000-0000-0000-000000000001' order by id$$,
  $$values ('created'::text, '{"status": "open"}'::jsonb),
           ('status_changed'::text, '{"from": "open", "to": "done"}'::jsonb)$$,
  'Status changes are logged by the database'
);
select is(
  (select actor_id from public.work_order_events
   where work_order_id = 'da000000-0000-0000-0000-000000000001' and type = 'status_changed'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  '...and attributed to whoever made them'
);

update public.work_orders set status = 'in_progress' where id = 'da000000-0000-0000-0000-000000000001';
select is(
  (select closed_at from public.work_orders where id = 'da000000-0000-0000-0000-000000000001'),
  null,
  'Reopening clears closed_at'
);

update public.work_orders set assignee_id = '22222222-2222-2222-2222-222222222222'
  where id = 'da000000-0000-0000-0000-000000000001';
select is(
  (select payload ->> 'to' from public.work_order_events
   where work_order_id = 'da000000-0000-0000-0000-000000000001' and type = 'assigned'),
  '22222222-2222-2222-2222-222222222222',
  'Assignments are logged'
);

-- People and customers going away ----------------------------------------------------------
delete from public.memberships
  where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = '22222222-2222-2222-2222-222222222222';
select is(
  (select assignee_id from public.work_orders where id = 'da000000-0000-0000-0000-000000000001'),
  null,
  'Removing a member unassigns their work orders'
);
select is(
  (select count(*)::int from public.work_order_events
   where work_order_id = 'da000000-0000-0000-0000-000000000001' and type = 'assigned' and payload ->> 'to' is null),
  1,
  '...and the unassignment shows up in the activity log'
);
select throws_ok(
  $$delete from public.customers where id = 'ca000000-0000-0000-0000-000000000001'$$,
  '23503',
  null,
  'Customers with work order history can''t be deleted'
);

-- Sending invitations --------------------------------------------------------------------
select lives_ok(
  $$insert into public.invitations (org_id, email) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'new@test.local')$$,
  'Owners can invite people'
);
select throws_ok(
  $$insert into public.invitations (org_id, email) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'new@test.local')$$,
  '23505',
  null,
  'There''s at most one pending invitation per email'
);
select throws_ok(
  $$insert into public.invitations (org_id, email) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', ' Mixed@Case.local')$$,
  '23514',
  null,
  'Invitation emails must be normalized (trimmed, lower case)'
);

-- Accepting invitations ------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select is_empty(
  'select * from public.my_pending_invitations()',
  'Expired invitations aren''t listed'
);
select throws_ok(
  $$select public.accept_invitation('f0000000-0000-0000-0000-000000000003')$$,
  'P0001',
  'This invitation is invalid or has expired.',
  'Expired invitations can''t be accepted'
);
select throws_ok(
  $$select public.accept_invitation('f0000000-0000-0000-0000-000000000001')$$,
  '42501',
  'This invitation was sent to a different email address.',
  'Invitations can''t be accepted by someone else'
);

set local request.jwt.claims to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';
select throws_ok(
  $$select public.accept_invitation('f0000000-0000-0000-0000-000000000002')$$,
  '42501',
  'Confirm your email address before accepting invitations.',
  'An unconfirmed email address can''t accept invitations'
);

set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select results_eq(
  'select org_name from public.my_pending_invitations()',
  $$values ('Org A'::text)$$,
  'Invitees see their pending invitations'
);
select is(
  public.accept_invitation('f0000000-0000-0000-0000-000000000001'),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'The invitee can accept'
);
select is(
  (select count(*)::int from public.work_orders where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  3,
  '...and immediately sees the organization''s work orders'
);
select throws_ok(
  $$select public.accept_invitation('f0000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'This invitation is invalid or has expired.',
  'An invitation can only be used once'
);

reset role;
select lives_ok(
  $$delete from public.organizations where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  'Deleting an organization cascades through everything it owns'
);

select * from finish();
rollback;

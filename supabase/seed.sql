-- =============================================================================
-- Local development seed (runs on `supabase start` / `supabase db reset`).
--
-- Demo logins, password for all: password123
--   anna@demo.test   owner of Kovács Bike Service
--   bence@demo.test  member (technician) at Kovács Bike Service
--   dora@demo.test   owner of Nagy Appliance Repair, with a pending invite to Kovács
--
-- Log in as Dóra and as Anna side by side to see tenant isolation in action.
-- =============================================================================

-- Users ----------------------------------------------------------------------
-- GoTrue expects the token columns to be '' rather than null.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}', jsonb_build_object('full_name', u.full_name),
  now(), now(), '', '', '', ''
from (values
  ('00000000-0000-4000-8000-0000000000a1'::uuid, 'anna@demo.test',  'Anna Kovács'),
  ('00000000-0000-4000-8000-0000000000a2'::uuid, 'bence@demo.test', 'Bence Tóth'),
  ('00000000-0000-4000-8000-0000000000b1'::uuid, 'dora@demo.test',  'Dóra Nagy')
) as u (id, email, full_name);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text,
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users
where email like '%@demo.test';

-- Organizations ----------------------------------------------------------------
insert into public.organizations (id, name, created_by) values
  ('00000000-0000-4000-8000-00000000000a', 'Kovács Bike Service',   '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-00000000000b', 'Nagy Appliance Repair', '00000000-0000-4000-8000-0000000000b1');

insert into public.memberships (org_id, user_id, role) values
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a1', 'owner'),
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a2', 'member'),
  ('00000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000b1', 'owner');

insert into public.customers (id, org_id, name, email, phone, address, notes) values
  ('00000000-0000-4000-8000-000000000c01', '00000000-0000-4000-8000-00000000000a',
   'Szabó Péter', 'peter.szabo@example.com', '+36 30 123 4567', 'Budapest, Király u. 12.', 'Commutes daily, prefers SMS.'),
  ('00000000-0000-4000-8000-000000000c02', '00000000-0000-4000-8000-00000000000a',
   'Kiss Eszter', 'eszter.kiss@example.com', '+36 20 987 6543', null, null),
  ('00000000-0000-4000-8000-000000000c03', '00000000-0000-4000-8000-00000000000a',
   'Futár Kft.', 'flotta@futar.example', '+36 1 555 0101', 'Budapest, Váci út 80.', 'Fleet of 14 cargo bikes. Invoice monthly.'),
  ('00000000-0000-4000-8000-000000000c04', '00000000-0000-4000-8000-00000000000b',
   'Horváth Judit', 'judit.h@example.com', '+36 70 222 3344', 'Debrecen, Piac u. 5.', null);

-- Work orders, created "as" real users so created_by and the activity log are
-- filled in exactly like they would be through the app.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000a1"}', false);

insert into public.work_orders (org_id, customer_id, title, description, priority, assignee_id, due_date, created_at) values
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000c01',
   'Hydraulic brake bleed, front and rear', 'Levers feel spongy. Customer mentioned a squeal on the rear rotor too.',
   'high', '00000000-0000-4000-8000-0000000000a2', current_date - 1, now() - interval '6 days'),
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000c03',
   'Monthly fleet inspection (14 cargo bikes)', 'Standard checklist: brakes, chain wear, tyre pressure, lights.',
   'normal', '00000000-0000-4000-8000-0000000000a1', current_date + 3, now() - interval '4 days'),
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000c02',
   'Replace chain and cassette', 'Chain at 0.75 wear. Quote approved by phone.',
   'normal', '00000000-0000-4000-8000-0000000000a2', current_date + 1, now() - interval '3 days'),
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000c03',
   'E-bike motor error E07', 'Bike #9 from the Futár fleet. Waiting on diagnostic cable from the supplier.',
   'urgent', null, current_date + 2, now() - interval '2 days'),
  ('00000000-0000-4000-8000-00000000000a', null,
   'Restock inner tubes (700x28, 29x2.4)', '',
   'low', null, null, now() - interval '1 day');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1"}', false);

insert into public.work_orders (org_id, customer_id, title, description, priority, assignee_id, due_date, created_at) values
  ('00000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-000000000c04',
   'Washing machine drains slowly', 'Model: WM-7120. Probably the pump filter.',
   'normal', '00000000-0000-4000-8000-0000000000b1', current_date + 5, now() - interval '1 day');

-- Bence works through his queue.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000a2"}', false);

update public.work_orders set status = 'in_progress'
where org_id = '00000000-0000-4000-8000-00000000000a' and number = 1;

update public.work_orders set status = 'done'
where org_id = '00000000-0000-4000-8000-00000000000a' and number = 3;

update public.work_orders set status = 'waiting'
where org_id = '00000000-0000-4000-8000-00000000000a' and number = 4;

insert into public.work_order_events (org_id, work_order_id, type, body)
select org_id, id, 'comment', 'Rear rotor is glazed, will sand it and replace pads. Ordered Shimano B05S.'
from public.work_orders where org_id = '00000000-0000-4000-8000-00000000000a' and number = 1;

insert into public.work_order_events (org_id, work_order_id, type, body)
select org_id, id, 'comment', 'Supplier says the cable ships Thursday.'
from public.work_orders where org_id = '00000000-0000-4000-8000-00000000000a' and number = 4;

-- Anna invites Dóra to help out at the bike shop.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000a1"}', false);

insert into public.invitations (org_id, email, role)
values ('00000000-0000-4000-8000-00000000000a', 'dora@demo.test', 'member');

select set_config('request.jwt.claims', '', false);

-- Spread the activity out over the days the work orders were created, so the
-- timeline looks like real history rather than "everything happened just now".
update public.work_order_events e
set created_at = wo.created_at + case e.type
  when 'created' then interval '0'
  when 'status_changed' then interval '1 day'
  else interval '1 day 2 hours'
end
from public.work_orders wo
where wo.id = e.work_order_id;

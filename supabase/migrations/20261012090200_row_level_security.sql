-- =============================================================================
-- Privileges and Row Level Security
--
-- Two layers, on purpose:
--   * GRANTs decide which columns a role may touch at all. RLS works on rows,
--     not columns, so without column grants any member could PATCH
--     work_orders.org_id, forge work_order_events.actor_id, or reset
--     organizations.work_order_seq.
--   * Policies decide which rows. Membership is resolved once per statement
--     via `org_id in (select private.my_org_ids())`.
--
-- anon gets nothing. Writes that span several rows (creating an org, accepting
-- an invitation) go through the RPCs in the previous migration rather than
-- INSERT policies.
-- =============================================================================

-- Supabase grants ALL on public tables to anon and authenticated by default.
-- Start from zero instead, and make future tables private until granted.
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

alter table public.profiles          enable row level security;
alter table public.organizations     enable row level security;
alter table public.memberships       enable row level security;
alter table public.invitations       enable row level security;
alter table public.customers         enable row level security;
alter table public.work_orders       enable row level security;
alter table public.work_order_events enable row level security;

-- profiles --------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

create policy "Read own profile and teammates' profiles"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or id in (select private.my_teammate_ids()));

create policy "Update own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- organizations ---------------------------------------------------------------
-- Created via create_organization(). Deleting an org isn't exposed to clients.
grant select on public.organizations to authenticated;
grant update (name) on public.organizations to authenticated;

create policy "Members read their organizations"
  on public.organizations for select to authenticated
  using (id in (select private.my_org_ids()));

create policy "Owners rename their organizations"
  on public.organizations for update to authenticated
  using (id in (select private.my_owned_org_ids()))
  with check (id in (select private.my_owned_org_ids()));

-- memberships -----------------------------------------------------------------
-- Rows are created only by create_organization() and accept_invitation().
grant select, delete on public.memberships to authenticated;
grant update (role) on public.memberships to authenticated;

create policy "Members see who else is in their organizations"
  on public.memberships for select to authenticated
  using (org_id in (select private.my_org_ids()));

create policy "Owners change roles"
  on public.memberships for update to authenticated
  using (org_id in (select private.my_owned_org_ids()))
  with check (org_id in (select private.my_owned_org_ids()));

create policy "Owners remove members; anyone can leave"
  on public.memberships for delete to authenticated
  using (
    org_id in (select private.my_owned_org_ids())
    or user_id = (select auth.uid())
  );

-- invitations -----------------------------------------------------------------
-- Owner-only. Invitees see theirs through my_pending_invitations().
grant select, delete on public.invitations to authenticated;
grant insert (org_id, email, role) on public.invitations to authenticated;

create policy "Owners see their organizations' invitations"
  on public.invitations for select to authenticated
  using (org_id in (select private.my_owned_org_ids()));

create policy "Owners invite people"
  on public.invitations for insert to authenticated
  with check (org_id in (select private.my_owned_org_ids()));

create policy "Owners revoke invitations"
  on public.invitations for delete to authenticated
  using (org_id in (select private.my_owned_org_ids()));

-- customers -------------------------------------------------------------------
grant select, delete on public.customers to authenticated;
grant insert (org_id, name, email, phone, address, notes) on public.customers to authenticated;
grant update (name, email, phone, address, notes) on public.customers to authenticated;

create policy "Members read customers"
  on public.customers for select to authenticated
  using (org_id in (select private.my_org_ids()));

create policy "Members add customers"
  on public.customers for insert to authenticated
  with check (org_id in (select private.my_org_ids()));

create policy "Members edit customers"
  on public.customers for update to authenticated
  using (org_id in (select private.my_org_ids()))
  with check (org_id in (select private.my_org_ids()));

create policy "Owners delete customers"
  on public.customers for delete to authenticated
  using (org_id in (select private.my_owned_org_ids()));

-- work orders -----------------------------------------------------------------
-- number, created_by, timestamps and closed_at are set by defaults/triggers.
grant select, delete on public.work_orders to authenticated;
grant insert (org_id, customer_id, title, description, status, priority, assignee_id, due_date)
  on public.work_orders to authenticated;
grant update (customer_id, title, description, status, priority, assignee_id, due_date)
  on public.work_orders to authenticated;

create policy "Members read work orders"
  on public.work_orders for select to authenticated
  using (org_id in (select private.my_org_ids()));

create policy "Members create work orders"
  on public.work_orders for insert to authenticated
  with check (org_id in (select private.my_org_ids()));

create policy "Members edit work orders"
  on public.work_orders for update to authenticated
  using (org_id in (select private.my_org_ids()))
  with check (org_id in (select private.my_org_ids()));

create policy "Owners delete work orders"
  on public.work_orders for delete to authenticated
  using (org_id in (select private.my_owned_org_ids()));

-- work order events -----------------------------------------------------------
-- Users may only add comments, as themselves. No UPDATE/DELETE grant at all:
-- the log is append-only.
grant select on public.work_order_events to authenticated;
grant insert (org_id, work_order_id, type, body) on public.work_order_events to authenticated;

create policy "Members read activity"
  on public.work_order_events for select to authenticated
  using (org_id in (select private.my_org_ids()));

create policy "Members comment as themselves"
  on public.work_order_events for insert to authenticated
  with check (
    org_id in (select private.my_org_ids())
    and type = 'comment'
    and actor_id = (select auth.uid())
  );

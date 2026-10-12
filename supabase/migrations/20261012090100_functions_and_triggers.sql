-- =============================================================================
-- Functions and triggers.
--
-- Conventions for every SECURITY DEFINER function here:
--   * `set search_path = ''` and fully qualified names, so a caller can't
--     shadow a table or function with their own object.
--   * Internal helpers live in the `private` schema, which PostgREST doesn't
--     expose. Policies can call them, but they're not API endpoints.
--   * EXECUTE is revoked from PUBLIC and granted only where needed (bottom of
--     this file).
-- =============================================================================

create schema private;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- RLS helpers
--
-- They're SECURITY DEFINER so they can read memberships without recursing into
-- memberships' own policies. They return sets so policies can use
-- `org_id in (select private.my_org_ids())`: Postgres runs the subquery once
-- per statement instead of once per row.
-- -----------------------------------------------------------------------------

create function private.my_org_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select org_id from public.memberships where user_id = (select auth.uid());
$$;

create function private.my_owned_org_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select org_id from public.memberships
  where user_id = (select auth.uid()) and role = 'owner';
$$;

create function private.my_teammate_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select distinct teammate.user_id
  from public.memberships mine
  join public.memberships teammate on teammate.org_id = mine.org_id
  where mine.user_id = (select auth.uid());
$$;

-- Returns null instead of raising on malformed input.
create function private.try_uuid(value text)
returns uuid
language sql immutable set search_path = ''
as $$
  select case
    when value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then value::uuid
  end;
$$;

-- Attachment objects are stored as {org_id}/{work_order_id}/{file}. The path
-- is the authorization key, so both segments must match a real work order in
-- an org the caller belongs to. A malformed path doesn't match (try_uuid),
-- rather than raising an error for every row in a listing.
create function private.can_access_attachment(object_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.work_orders wo
    join public.memberships m on m.org_id = wo.org_id
    where wo.org_id = private.try_uuid((storage.foldername(object_name))[1])
      and wo.id = private.try_uuid((storage.foldername(object_name))[2])
      and m.user_id = (select auth.uid())
  );
$$;

-- Uploaders can delete their own files; org owners can delete any file in
-- their org (needed to clean up when a work order is deleted).
create function private.can_delete_attachment(object_name text, object_owner_id text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.can_access_attachment(object_name)
     and (
       object_owner_id = (select auth.uid())::text
       or private.try_uuid((storage.foldername(object_name))[1]) in (select private.my_owned_org_ids())
     );
$$;

-- -----------------------------------------------------------------------------
-- Profiles mirror auth.users
-- -----------------------------------------------------------------------------

create function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    lower(new.email),
    left(coalesce(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 120)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.handle_user_email_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set email = lower(new.email) where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (new.email is distinct from old.email)
  execute function private.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- Work orders: numbering, lifecycle timestamps, activity log
-- -----------------------------------------------------------------------------

-- Per-org numbers come from a counter on the organization row rather than a
-- sequence. The UPDATE row-locks the org, so concurrent inserts in one org take
-- turns and never collide, and because the counter is transactional a
-- rolled-back insert doesn't burn a number. The cost (inserts in the same org
-- serialize) is irrelevant at small-business scale.
create function private.assign_work_order_number()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.organizations
     set work_order_seq = work_order_seq + 1
   where id = new.org_id
  returning work_order_seq into new.number;
  return new;
end;
$$;

create trigger work_orders_assign_number
  before insert on public.work_orders
  for each row execute function private.assign_work_order_number();

-- closed_at and updated_at are derived data, so the database owns them.
create function private.set_work_order_lifecycle()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;

  if new.status in ('done', 'cancelled') then
    new.closed_at := coalesce(case when tg_op = 'UPDATE' then old.closed_at end, now());
  else
    new.closed_at := null;
  end if;

  return new;
end;
$$;

create trigger work_orders_lifecycle
  before insert or update on public.work_orders
  for each row execute function private.set_work_order_lifecycle();

-- System events are written by the database, not the client, so the history
-- stays complete and can't be forged or skipped by a buggy (or hostile) client.
create function private.log_work_order_changes()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.work_order_events (org_id, work_order_id, actor_id, type, payload)
    values (new.org_id, new.id, auth.uid(), 'created', jsonb_build_object('status', new.status));
    return null;
  end if;

  if new.status is distinct from old.status then
    insert into public.work_order_events (org_id, work_order_id, actor_id, type, payload)
    values (new.org_id, new.id, auth.uid(), 'status_changed',
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    insert into public.work_order_events (org_id, work_order_id, actor_id, type, payload)
    values (new.org_id, new.id, auth.uid(), 'assigned',
            jsonb_build_object('from', old.assignee_id, 'to', new.assignee_id));
  end if;

  return null;
end;
$$;

create trigger work_orders_log_changes
  after insert or update on public.work_orders
  for each row execute function private.log_work_order_changes();

-- -----------------------------------------------------------------------------
-- Memberships: an organization always keeps at least one owner
-- -----------------------------------------------------------------------------

create function private.ensure_org_keeps_an_owner()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- Lock the org row so two owners demoting each other at the same moment
  -- can't both pass the check below.
  perform 1 from public.organizations where id = old.org_id for update;

  -- The org itself is being deleted and cascading here: nothing to protect.
  if not found then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and not exists (
       select 1 from public.memberships
       where org_id = old.org_id and role = 'owner' and user_id <> old.user_id
     )
  then
    raise exception 'An organization needs at least one owner. Make someone else an owner first.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger memberships_keep_an_owner
  before update of role or delete on public.memberships
  for each row execute function private.ensure_org_keeps_an_owner();

-- -----------------------------------------------------------------------------
-- RPCs (exposed through PostgREST as /rpc/...)
--
-- These cover writes that must change several rows atomically, or that need to
-- look at data the caller can't read yet (an org they're about to join).
-- Expressing them as INSERT policies would be either impossible or far less
-- obvious to review.
-- -----------------------------------------------------------------------------

create function public.create_organization(org_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  new_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  insert into public.organizations (name, created_by)
  values (btrim(org_name), auth.uid())
  returning id into new_org_id;

  insert into public.memberships (org_id, user_id, role)
  values (new_org_id, auth.uid(), 'owner');

  return new_org_id;
end;
$$;

-- The caller's email, but only once they've proven they own it. Without the
-- confirmation check, anyone could sign up as someone else's address and
-- accept the invitations sent to it.
create function private.my_confirmed_email()
returns text
language sql stable security definer set search_path = ''
as $$
  select lower(email) from auth.users
  where id = (select auth.uid()) and email_confirmed_at is not null;
$$;

create function public.my_pending_invitations()
returns table (
  token      uuid,
  org_id     uuid,
  org_name   text,
  role       public.org_role,
  invited_by text,
  expires_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select i.token, i.org_id, o.name, i.role, nullif(p.full_name, ''), i.expires_at
  from public.invitations i
  join public.organizations o on o.id = i.org_id
  left join public.profiles p on p.id = i.invited_by
  where i.email = private.my_confirmed_email()
    and i.accepted_at is null
    and i.expires_at > now()
    and not exists (
      select 1 from public.memberships m
      where m.org_id = i.org_id and m.user_id = (select auth.uid())
    )
  order by i.created_at desc;
$$;

create function public.accept_invitation(invite_token uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  caller_email text;
  invite public.invitations;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into invite
  from public.invitations
  where token = invite_token
  for update;

  -- One message for "unknown", "already used" and "expired", so the endpoint
  -- can't be used to probe which tokens exist.
  if not found or invite.accepted_at is not null or invite.expires_at <= now() then
    raise exception 'This invitation is invalid or has expired.';
  end if;

  caller_email := private.my_confirmed_email();
  if caller_email is null then
    raise exception 'Confirm your email address before accepting invitations.' using errcode = '42501';
  end if;
  if invite.email <> caller_email then
    raise exception 'This invitation was sent to a different email address.' using errcode = '42501';
  end if;

  insert into public.memberships (org_id, user_id, role)
  values (invite.org_id, auth.uid(), invite.role)
  on conflict (org_id, user_id) do nothing;

  update public.invitations set accepted_at = now() where id = invite.id;

  return invite.org_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Function privileges. Postgres grants EXECUTE to PUBLIC by default, and
-- Supabase additionally grants it to anon/authenticated in schema public.
-- -----------------------------------------------------------------------------

revoke all on all functions in schema private from public;
grant execute on function
  private.my_org_ids(),
  private.my_owned_org_ids(),
  private.my_teammate_ids(),
  private.can_access_attachment(text),
  private.can_delete_attachment(text, text)
to authenticated;

revoke all on function public.create_organization(text) from public, anon;
revoke all on function public.my_pending_invitations() from public, anon;
revoke all on function public.accept_invitation(uuid) from public, anon;
grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.my_pending_invitations() to authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;

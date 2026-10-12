-- =============================================================================
-- Core schema: tenants (organizations), people, and the work they track.
--
-- Every tenant-owned table carries org_id. Child rows point at their parents
-- through composite foreign keys on (org_id, id), so the database itself
-- guarantees a work order can never reference another organization's customer
-- or assignee, no matter what a client sends.
-- =============================================================================

create type public.org_role as enum ('owner', 'member');
create type public.work_order_status as enum ('open', 'in_progress', 'waiting', 'done', 'cancelled');
create type public.work_order_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.work_order_event_type as enum ('created', 'status_changed', 'assigned', 'comment');

-- One row per auth user, kept in sync with auth.users by triggers.
-- It lives in public so PostgREST can embed it; auth.users is never exposed.
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,  -- null for non-email sign-in methods
  full_name  text not null default '' check (char_length(full_name) <= 120),
  created_at timestamptz not null default now()
);

create table public.organizations (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(btrim(name)) between 1 and 80),
  -- Counter behind the per-organization work order numbers (#1, #2, ...).
  -- Only the numbering trigger writes it; clients have no UPDATE grant on it.
  work_order_seq integer not null default 0,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

create table public.memberships (
  org_id     uuid not null references public.organizations (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
-- The PK serves lookups by org. This one serves "which orgs am I in?",
-- which every RLS check asks.
create index memberships_user_id_idx on public.memberships (user_id);

create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  email       text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  role        public.org_role not null default 'member',
  -- The secret in the invite link (122 random bits).
  token       uuid not null unique default gen_random_uuid(),
  invited_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz
);
-- At most one open invitation per email per org.
create unique index invitations_one_pending_per_email
  on public.invitations (org_id, email) where accepted_at is null;

create table public.customers (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 120),
  email      text check (char_length(email) <= 254),
  phone      text check (char_length(phone) <= 40),
  address    text check (char_length(address) <= 300),
  notes      text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  -- Target for composite foreign keys from child tables.
  constraint customers_org_id_id_key unique (org_id, id)
);
create index customers_org_id_name_idx on public.customers (org_id, name);

create table public.work_orders (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  number      integer not null,  -- assigned by a trigger, unique per org
  customer_id uuid,
  title       text not null check (char_length(btrim(title)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 10000),
  status      public.work_order_status not null default 'open',
  priority    public.work_order_priority not null default 'normal',
  assignee_id uuid,
  due_date    date,
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  closed_at   timestamptz,  -- maintained by a trigger from status

  constraint work_orders_org_id_number_key unique (org_id, number),
  constraint work_orders_org_id_id_key unique (org_id, id),
  -- The customer must belong to the same org. NO ACTION (the default) means a
  -- customer with work order history can't be deleted, while deleting a whole
  -- organization still cascades cleanly (NO ACTION is checked at statement end).
  constraint work_orders_org_id_customer_id_fkey
    foreign key (org_id, customer_id) references public.customers (org_id, id),
  -- The assignee must be a member of the same org. When they leave, their work
  -- orders become unassigned instead of blocking the removal. Only assignee_id
  -- is nulled; org_id stays put (column list needs Postgres 15+).
  constraint work_orders_org_id_assignee_id_fkey
    foreign key (org_id, assignee_id) references public.memberships (org_id, user_id)
    on delete set null (assignee_id)
);
create index work_orders_org_id_status_idx on public.work_orders (org_id, status);
create index work_orders_org_id_assignee_id_idx on public.work_orders (org_id, assignee_id);
create index work_orders_org_id_customer_id_idx on public.work_orders (org_id, customer_id);

-- Append-only activity log: system events (written by triggers) and comments
-- (written by users) in one timeline.
create table public.work_order_events (
  id            bigint generated always as identity primary key,
  org_id        uuid not null,
  work_order_id uuid not null,
  actor_id      uuid references public.profiles (id) on delete set null default auth.uid(),
  type          public.work_order_event_type not null,
  body          text check (char_length(btrim(body)) between 1 and 5000),
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),

  constraint work_order_events_org_id_work_order_id_fkey
    foreign key (org_id, work_order_id) references public.work_orders (org_id, id) on delete cascade,
  -- Comments have a body; system events don't.
  constraint work_order_events_body_only_on_comments check ((type = 'comment') = (body is not null))
);
create index work_order_events_work_order_id_created_at_idx
  on public.work_order_events (work_order_id, created_at);

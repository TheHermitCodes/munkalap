# Architecture and decisions

This document explains *why* the code is shaped the way it is. Each section names the decision, the alternatives, and the trade-off. The short version: **Postgres owns the rules, Next.js owns the experience.**

## 1. The database is the security boundary

**Decision.** Every table has Row Level Security. The app talks to Supabase *as the signed-in user* (their JWT, from cookies), never with the service role key. Nothing in `app/` or `lib/` decides who may see or change a row.

**Why.** Authorization written in application code has to be repeated in every route, Server Action, Edge Function, and future mobile app, and one forgotten check is a data leak. With RLS, a new client (a script, a cron job, a second frontend) gets the same rules for free. The same session also works for direct browser→Storage uploads, which would be unsafe under any other model.

**Trade-off.** Policies are harder to read than an `if` statement, and mistakes are silent: a wrong policy returns *zero rows*, not an error. That's why `supabase/tests/database/` exists. The tests are the readable spec of the policies.

**What the app still does.** It hides buttons that won't work (only owners see "Delete"), and it validates input shape with zod. Both are for UX and clear error messages, not security.

## 2. Tenant consistency through composite foreign keys

**Decision.** Child tables reference parents on `(org_id, id)`, not just `id`:

```sql
foreign key (org_id, customer_id) references customers (org_id, id)
foreign key (org_id, assignee_id) references memberships (org_id, user_id)
```

**Why.** RLS checks that you can write *this* row in *your* org, but it doesn't look at what the row points to. With a plain `customer_id` foreign key, a member of two organizations could attach Org A's work order to Org B's customer. The composite key makes that state unrepresentable. It also means "the assignee must be a member of this org" is a foreign key, not a trigger or app check.

**Bonus.** `on delete set null (assignee_id)` (Postgres 15+) unassigns a person's work orders when they leave the org, and the activity-log trigger records the unassignment.

## 3. Column privileges in addition to RLS

**Decision.** `revoke all` from `anon`/`authenticated`, then grant only specific columns:

```sql
grant update (customer_id, title, description, status, priority, assignee_id, due_date)
  on public.work_orders to authenticated;
```

**Why.** RLS is row-level. Without column grants, anyone who can update a work order could also `PATCH` its `org_id`, `number`, `created_by` or `closed_at`, or reset `organizations.work_order_seq`. Supabase's default is to grant everything to `anon` and `authenticated`; the RLS migration also changes the *default* privileges, so a future table is invisible to the API until someone grants access on purpose.

## 4. Derived data and history are written by the database

| Data | Written by | Why not the app |
|---|---|---|
| `work_orders.number` | `BEFORE INSERT` trigger | Needs a lock to stay unique per org under concurrency |
| `updated_at`, `closed_at` | `BEFORE` trigger | Derived from `status`; can't drift |
| `created_by`, comment `actor_id` | column default `auth.uid()` + no grant | Can't be spoofed |
| Status/assignment events | `AFTER` trigger | Every write path is covered, including future ones |
| Profiles | trigger on `auth.users` | Exists before the user's first request |

The activity log (`work_order_events`) is append-only: there's no UPDATE or DELETE grant, and users may only insert `type = 'comment'` rows as themselves.

**Per-org numbering.** A sequence would give global numbers (#4182 for a shop with 12 jobs). Instead, a counter column on `organizations` is incremented in the insert trigger. The `UPDATE` row-locks the organization, so concurrent inserts take turns and can't collide. Because it's transactional, a rolled-back insert doesn't burn a number. The cost (inserts *within one org* serialize) doesn't matter at this scale. For legally gapless numbering such as invoices, you'd also forbid deletes.

## 5. RPCs for multi-row, atomic operations

`create_organization()` and `accept_invitation()` are `SECURITY DEFINER` functions instead of INSERT policies on `memberships`.

- Creating an org must also create the owner membership. As two client inserts, a failure in between leaves an org nobody can see.
- Accepting an invitation needs to read an invitation the user can't see yet, check the email, create a membership and mark the invitation used, all in one transaction with a row lock.

Every `SECURITY DEFINER` function pins `search_path = ''` and schema-qualifies every name, and `EXECUTE` is revoked from `public`/`anon`. Internal helpers live in a `private` schema that PostgREST doesn't expose.

## 6. RLS performance

Policies use `org_id in (select private.my_org_ids())` rather than calling a per-row function such as `is_member(org_id)`. The subquery becomes an *initPlan* that runs once per statement, and `auth.uid()` is wrapped in `(select ...)` for the same reason. The membership lookups are covered by the primary key and `memberships_user_id_idx`.

## 7. Invitations

- The token is a random UUID (122 bits) that only owners can read.
- `accept_invitation()` requires the invitee's email to be **confirmed** and to match the invitation. Without the confirmation check, anyone could sign up with someone else's address and take their invitations. (Local dev has confirmations off; production must turn them on.)
- "Unknown", "expired" and "already used" tokens all return the same message, so the endpoint can't be used to find valid tokens.
- One pending invitation per email per org (partial unique index).
- Emails must be stored normalized; the check constraint rejects `' Mixed@Case.com'` rather than silently creating a near-duplicate.

## 8. Next.js: what runs where

| Concern | Where | Why |
|---|---|---|
| Reading data | Server Components (`lib/data.ts`) | No client-side fetching state; the user's JWT never needs to be readable by JS |
| Writes | Server Actions (`app/**/actions.ts`) | One round trip, input validated with zod at the boundary |
| Session refresh | `proxy.ts` | The one place cookies can always be written |
| File uploads | Browser → Storage directly | No server body limits or double bandwidth; Storage policies authorize the path |
| Download links | Signed URLs, 10 minutes | The bucket is private; links expire shortly after access is lost |
| Email | Edge Function | Holds the email API key; reusable by other clients |

Server Actions are public HTTP endpoints, so their arguments (including the bound `orgId`) are treated as untrusted and validated with zod.

Filters on the work order list live in the URL (`?view=closed&mine=1&q=brakes`), so views can be bookmarked and shared, and the server renders them without client state.

**Forms.** Forms use a small `useFormAction` hook instead of `<form action>` + `useActionState`, because React resets uncontrolled forms after every action, and that would wipe the user's input on a validation error.

## 9. The Edge Function uses the caller's JWT

`send-invite` creates its Supabase client with the caller's `Authorization` header, not the service role key. RLS only shows invitations to owners of the org, so a member, or a stranger with a guessed id, gets a 404, and the function doesn't re-implement that rule. It also HTML-escapes the organization name, because that's user input going into an email.

It could have been a Server Action with the API key in the Next.js environment. It's an Edge Function so email sending lives with the backend and can later be triggered by a database webhook or another client.

## 10. Things the generated types get wrong

`supabase gen types` is a great tool, but it describes the schema, not the behavior:

- `work_orders.number` is `NOT NULL` without a default, so the generated `Insert` type requires it, even though a trigger sets it and the column grant forbids clients from sending it. `createWorkOrder` casts and explains why.
- The `customer` embed on a work order is typed as non-null, because the composite FK includes the non-null `org_id`. `customer_id` *is* nullable, so `lib/data.ts` widens the type to `| null`.
- Insert/Update types list every column, but column grants make most of them read-only. The zod schemas in `lib/validation.ts` describe what a client may actually send.

## 11. Time zones

Due dates are Postgres `date`s (a calendar day, no time zone), and "overdue" compares them with *today in Budapest*, not today on the server (usually UTC). Otherwise a job due today would show as overdue for the first hours after midnight. A product serving several countries would store a time zone per organization.

## Review checklist

Mistakes that show up often in generated Supabase code, each of which this codebase avoids on purpose:

- [ ] RLS enabled on every table? A table without it is fully public through the API.
- [ ] Policies `to authenticated`, not the default `public`?
- [ ] `using (true)` anywhere? It's almost never right.
- [ ] INSERT/UPDATE policies have `with check`, so a row can't be moved into another tenant?
- [ ] Foreign keys stay inside the tenant (composite keys, or a check)?
- [ ] Column grants for fields the client must not set (`org_id`, owner, counters, timestamps)?
- [ ] `SECURITY DEFINER` functions have `set search_path = ''` and live outside exposed schemas, or are meant to be RPCs?
- [ ] Authorization uses `auth.uid()`/membership tables, not `user_metadata` (users can edit their own metadata)?
- [ ] Service role key only where nothing else will do, never in the browser?
- [ ] Server-side auth checks use `getClaims()`/`getUser()` (verified), not `getSession()` (just decoded)?
- [ ] Redirect targets from query strings are checked (no open redirects)?
- [ ] Every policy is covered by a test that tries to break it?

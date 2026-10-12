import 'server-only'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { attachmentDisplayName, attachmentFolder, ATTACHMENTS_BUCKET } from './attachments'
import { requireUser } from './auth'
import { createClient } from './supabase/server'
import { idSchema } from './validation'
import { CLOSED_STATUSES, escapeLike, OPEN_STATUSES, parseSearch, type WorkOrderFilters } from './work-orders'

// Read-side data access for Server Components.
//
// Every query runs as the signed-in user, so RLS already limits rows to the
// organizations they belong to. The explicit `.eq('org_id', ...)` filters pick
// the *one* organization being viewed; they're not what keeps data private.

function assertId(value: string): string {
  if (!idSchema.safeParse(value).success) notFound()
  return value
}

// -- Organizations & people --------------------------------------------------------

/** The org being viewed and the viewer's role in it. 404s for non-members. */
export const getOrgContext = cache(async (orgId: string) => {
  assertId(orgId)
  const user = await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('memberships')
    .select('role, organization:organizations(id, name)')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) notFound()
  return { org: data.organization, role: data.role, isOwner: data.role === 'owner', user }
})

export const getMyOrganizations = cache(async () => {
  const user = await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('memberships')
    .select('role, organization:organizations(id, name)')
    .eq('user_id', user.id)
    .order('created_at')
  if (error) throw new Error(error.message)
  return data
})

export async function getMyPendingInvitations() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('my_pending_invitations')
  if (error) throw new Error(error.message)
  return data
}

export type Member = Awaited<ReturnType<typeof getMembers>>[number]

export const getMembers = cache(async (orgId: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('memberships')
    .select('user_id, role, created_at, profile:profiles(full_name, email)')
    .eq('org_id', orgId)
    .order('created_at')
  if (error) throw new Error(error.message)
  return data.map((m) => ({
    userId: m.user_id,
    role: m.role,
    joinedAt: m.created_at,
    name: m.profile?.full_name || m.profile?.email || 'Unnamed member',
    email: m.profile?.email ?? null,
  }))
})

/** user id → display name, for rendering assignees and activity. */
export async function getMemberNames(orgId: string): Promise<Map<string, string>> {
  const members = await getMembers(orgId)
  return new Map(members.map((m) => [m.userId, m.name]))
}

export async function getInvitations(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invitations')
    .select('id, email, role, token, created_at, expires_at')
    .eq('org_id', orgId)
    .is('accepted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

// -- Work orders ---------------------------------------------------------------------

// supabase-js infers the customer embed as non-null because the composite FK
// (org_id, customer_id) includes the non-null org_id. customer_id itself is
// nullable, so at runtime the embed is null for work orders without a customer.
type Nullable<T, K extends keyof T> = Omit<T, K> & { [P in K]: T[P] | null }

export type WorkOrderListItem = Awaited<ReturnType<typeof listWorkOrders>>[number]

export async function listWorkOrders(
  orgId: string,
  filters: WorkOrderFilters & { customerId?: string; userId?: string },
) {
  const supabase = await createClient()
  let query = supabase
    .from('work_orders')
    .select('id, number, title, status, priority, due_date, assignee_id, updated_at, customer:customers(id, name)')
    .eq('org_id', orgId)
    .order('number', { ascending: false })
    .limit(200)

  if (filters.view === 'open') query = query.in('status', OPEN_STATUSES)
  if (filters.view === 'closed') query = query.in('status', CLOSED_STATUSES)
  if (filters.mine && filters.userId) query = query.eq('assignee_id', filters.userId)
  if (filters.customerId) query = query.eq('customer_id', filters.customerId)

  const search = parseSearch(filters.q)
  if (search && 'number' in search) query = query.eq('number', search.number)
  if (search && 'text' in search) query = query.ilike('title', `%${escapeLike(search.text)}%`)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as Nullable<(typeof data)[number], 'customer'>[]
}

export async function getWorkOrder(orgId: string, number: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('work_orders')
    .select('*, customer:customers(id, name, phone, email)')
    .eq('org_id', orgId)
    .eq('number', number)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) notFound()
  return data as Nullable<typeof data, 'customer'>
}

export async function getWorkOrderEvents(workOrderId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('work_order_events')
    .select('id, type, body, payload, actor_id, created_at')
    .eq('work_order_id', workOrderId)
    .order('created_at')
    .order('id')
  if (error) throw new Error(error.message)
  return data
}

export type Attachment = Awaited<ReturnType<typeof getAttachments>>[number]

/**
 * Lists a work order's files with short-lived download links. Links are signed
 * per request, so they stop working shortly after someone loses access.
 */
export async function getAttachments(orgId: string, workOrderId: string) {
  const supabase = await createClient()
  const folder = attachmentFolder(orgId, workOrderId)
  const storage = supabase.storage.from(ATTACHMENTS_BUCKET)

  const { data: files, error } = await storage.list(folder, {
    limit: 1000,
    sortBy: { column: 'created_at', order: 'asc' },
  })
  if (error) throw new Error(error.message)

  const objects = files.filter((f) => f.id !== null)
  if (objects.length === 0) return []

  const paths = objects.map((f) => `${folder}/${f.name}`)
  const { data: signed, error: signError } = await storage.createSignedUrls(paths, 60 * 10, { download: true })
  if (signError) throw new Error(signError.message)

  return objects.map((file, i) => ({
    path: paths[i]!,
    name: attachmentDisplayName(file.name),
    size: typeof file.metadata?.size === 'number' ? file.metadata.size : null,
    createdAt: file.created_at,
    url: signed[i]?.signedUrl ?? null,
  }))
}

// -- Customers -----------------------------------------------------------------------

export async function listCustomers(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, email, phone, work_orders(count)')
    .eq('org_id', orgId)
    .order('name')
  if (error) throw new Error(error.message)
  return data.map(({ work_orders, ...customer }) => ({
    ...customer,
    workOrderCount: work_orders[0]?.count ?? 0,
  }))
}

export async function getCustomerOptions(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('customers').select('id, name').eq('org_id', orgId).order('name')
  if (error) throw new Error(error.message)
  return data
}

export async function getCustomer(orgId: string, customerId: string) {
  assertId(customerId)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('org_id', orgId)
    .eq('id', customerId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) notFound()
  return data
}

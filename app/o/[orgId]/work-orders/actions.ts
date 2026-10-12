'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { failure, success, type ActionState } from '@/lib/action-state'
import { attachmentFolder, ATTACHMENTS_BUCKET } from '@/lib/attachments'
import type { TablesInsert, TablesUpdate } from '@/lib/database.types'
import { getCurrentUser } from '@/lib/auth'
import { toUserMessage } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { commentSchema, firstIssue, formValues, isId, workOrderFieldSchema, workOrderSchema } from '@/lib/validation'

// Server Actions are public endpoints: the arguments (including the bound
// orgId) come from the browser and are validated here. Whether the user may
// actually do the thing is decided by RLS, so nothing here re-checks roles
// except to give a friendlier message.

const INVALID = failure('That request was not valid. Reload the page and try again.')
const GONE = failure("This work order no longer exists, or you don't have access to it any more.")

function revalidateOrg(orgId: string) {
  revalidatePath(`/o/${orgId}`, 'layout')
}

export async function createWorkOrder(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isId(orgId)) return INVALID
  const parsed = workOrderSchema.safeParse(formValues(formData))
  if (!parsed.success) return failure(firstIssue(parsed.error))

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('work_orders')
    // `number` is assigned by a database trigger. Generated types can't know
    // about triggers, so they insist on it; the database rejects it if sent.
    .insert({ org_id: orgId, ...parsed.data } as TablesInsert<'work_orders'>)
    .select('number')
    .single()
  if (error) {
    return failure(toUserMessage(error, { '23503': 'That customer or team member no longer exists. Reload and try again.' }))
  }

  revalidateOrg(orgId)
  redirect(`/o/${orgId}/work-orders/${data.number}`)
}

/** Saves one field from the work order sidebar (status, assignee, ...). */
export async function updateWorkOrderField(orgId: string, workOrderId: string, input: unknown): Promise<ActionState> {
  if (!isId(orgId) || !isId(workOrderId)) return INVALID
  const parsed = workOrderFieldSchema.safeParse(input)
  if (!parsed.success) return INVALID

  const patch = { [parsed.data.field]: parsed.data.value } as TablesUpdate<'work_orders'>
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('work_orders')
    .update(patch)
    .eq('org_id', orgId)
    .eq('id', workOrderId)
    .select('id')
  if (error) {
    return failure(toUserMessage(error, { '23503': 'That customer or team member no longer exists. Reload and try again.' }))
  }
  if (data.length === 0) return GONE

  revalidateOrg(orgId)
  return success()
}

const detailsSchema = workOrderSchema.pick({ title: true, description: true })

export async function updateWorkOrderDetails(
  orgId: string,
  workOrderId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isId(orgId) || !isId(workOrderId)) return INVALID
  const parsed = detailsSchema.safeParse(formValues(formData))
  if (!parsed.success) return failure(firstIssue(parsed.error))

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('work_orders')
    .update(parsed.data)
    .eq('org_id', orgId)
    .eq('id', workOrderId)
    .select('id')
  if (error) return failure(toUserMessage(error))
  if (data.length === 0) return GONE

  revalidateOrg(orgId)
  return success()
}

export async function addComment(
  orgId: string,
  workOrderId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isId(orgId) || !isId(workOrderId)) return INVALID
  const parsed = commentSchema.safeParse(formValues(formData))
  if (!parsed.success) return failure(firstIssue(parsed.error))

  const supabase = await createClient()
  // actor_id is filled in by the database from the session; the client can't set it.
  const { error } = await supabase
    .from('work_order_events')
    .insert({ org_id: orgId, work_order_id: workOrderId, type: 'comment', body: parsed.data.body })
  if (error) return failure(toUserMessage(error))

  revalidateOrg(orgId)
  return success()
}

export async function deleteWorkOrder(orgId: string, workOrderId: string): Promise<ActionState> {
  if (!isId(orgId) || !isId(workOrderId)) return INVALID
  const user = await getCurrentUser()
  if (!user) return INVALID
  const supabase = await createClient()

  // RLS is what actually protects the row. This check only stops a member
  // from deleting their own uploads below before the row delete fails.
  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (membership?.role !== 'owner') return failure('Only owners can delete work orders.')

  // Files first: the storage policies match paths against existing work
  // orders, so once the row is gone nobody could delete its files any more.
  const folder = attachmentFolder(orgId, workOrderId)
  const storage = supabase.storage.from(ATTACHMENTS_BUCKET)
  const { data: files, error: listError } = await storage.list(folder, { limit: 1000 })
  if (listError) return failure(toUserMessage(listError))
  if (files.length > 0) {
    const { error: removeError } = await storage.remove(files.map((f) => `${folder}/${f.name}`))
    if (removeError) return failure(toUserMessage(removeError))
  }

  const { data, error } = await supabase
    .from('work_orders')
    .delete()
    .eq('org_id', orgId)
    .eq('id', workOrderId)
    .select('id')
  if (error) return failure(toUserMessage(error))
  if (data.length === 0) return GONE

  revalidateOrg(orgId)
  redirect(`/o/${orgId}/work-orders`)
}

export async function deleteAttachment(orgId: string, workOrderId: string, path: string): Promise<ActionState> {
  if (!isId(orgId) || !isId(workOrderId)) return INVALID
  if (typeof path !== 'string' || !path.startsWith(`${attachmentFolder(orgId, workOrderId)}/`)) return INVALID

  const supabase = await createClient()
  const { data, error } = await supabase.storage.from(ATTACHMENTS_BUCKET).remove([path])
  if (error) return failure(toUserMessage(error))
  // Storage reports success even when a policy filtered the file out.
  if (data.length === 0) return failure('You can only delete files you uploaded.')

  revalidateOrg(orgId)
  return success()
}

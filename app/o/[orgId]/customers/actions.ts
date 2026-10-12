'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { failure, success, type ActionState } from '@/lib/action-state'
import { toUserMessage } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { customerSchema, firstIssue, formValues, isId } from '@/lib/validation'

const INVALID = failure('That request was not valid. Reload the page and try again.')

export async function createCustomer(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isId(orgId)) return INVALID
  const parsed = customerSchema.safeParse(formValues(formData))
  if (!parsed.success) return failure(firstIssue(parsed.error))

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customers')
    .insert({ org_id: orgId, ...parsed.data })
    .select('id')
    .single()
  if (error) return failure(toUserMessage(error))

  revalidatePath(`/o/${orgId}`, 'layout')
  redirect(`/o/${orgId}/customers/${data.id}`)
}

export async function updateCustomer(
  orgId: string,
  customerId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isId(orgId) || !isId(customerId)) return INVALID
  const parsed = customerSchema.safeParse(formValues(formData))
  if (!parsed.success) return failure(firstIssue(parsed.error))

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customers')
    .update(parsed.data)
    .eq('org_id', orgId)
    .eq('id', customerId)
    .select('id')
  if (error) return failure(toUserMessage(error))
  if (data.length === 0) return failure("This customer no longer exists, or you don't have access to it.")

  revalidatePath(`/o/${orgId}`, 'layout')
  return success('Saved.')
}

export async function deleteCustomer(orgId: string, customerId: string): Promise<ActionState> {
  if (!isId(orgId) || !isId(customerId)) return INVALID

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customers')
    .delete()
    .eq('org_id', orgId)
    .eq('id', customerId)
    .select('id')
  if (error) {
    // The foreign key from work_orders refuses on purpose: job history is a
    // business record and shouldn't disappear with the customer.
    return failure(toUserMessage(error, { '23503': 'This customer has work orders, so they can’t be deleted.' }))
  }
  if (data.length === 0) return failure('Only owners can delete customers.')

  revalidatePath(`/o/${orgId}`, 'layout')
  redirect(`/o/${orgId}/customers`)
}

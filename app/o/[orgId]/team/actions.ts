'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { failure, success, type ActionState } from '@/lib/action-state'
import { getCurrentUser } from '@/lib/auth'
import { toUserMessage } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { firstIssue, formValues, invitationSchema, isId, roleSchema } from '@/lib/validation'

const INVALID = failure('That request was not valid. Reload the page and try again.')

export async function inviteMember(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isId(orgId)) return INVALID
  const parsed = invitationSchema.safeParse(formValues(formData))
  if (!parsed.success) return failure(firstIssue(parsed.error))

  const supabase = await createClient()
  const { data: invitation, error } = await supabase
    .from('invitations')
    .insert({ org_id: orgId, email: parsed.data.email, role: parsed.data.role })
    .select('id')
    .single()
  if (error) {
    return failure(
      toUserMessage(error, {
        '23505': `${parsed.data.email} already has a pending invitation. Revoke it first to send a new one.`,
        '42501': 'Only owners can invite people.',
      }),
    )
  }
  revalidatePath(`/o/${orgId}/team`)

  // The invitation exists either way; email is a convenience. The Edge Function
  // runs with this user's JWT, so it can only read invitations they could.
  const { data: sent, error: sendError } = await supabase.functions.invoke<{ sent: boolean }>('send-invite', {
    body: { invitationId: invitation.id },
  })
  if (sendError || !sent?.sent) {
    return success(`Invitation created. Email isn't set up here, so copy the link below and send it to ${parsed.data.email}.`)
  }
  return success(`Invitation emailed to ${parsed.data.email}.`)
}

export async function revokeInvitation(orgId: string, invitationId: string): Promise<ActionState> {
  if (!isId(orgId) || !isId(invitationId)) return INVALID
  const supabase = await createClient()
  const { error } = await supabase.from('invitations').delete().eq('org_id', orgId).eq('id', invitationId)
  if (error) return failure(toUserMessage(error))
  revalidatePath(`/o/${orgId}/team`)
  return success()
}

export async function changeRole(orgId: string, userId: string, role: unknown): Promise<ActionState> {
  const parsedRole = roleSchema.safeParse(role)
  if (!isId(orgId) || !isId(userId) || !parsedRole.success) return INVALID

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('memberships')
    .update({ role: parsedRole.data })
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .select('user_id')
  // The "at least one owner" rule lives in a database trigger; its message is shown as-is.
  if (error) return failure(toUserMessage(error))
  if (data.length === 0) return failure('Only owners can change roles.')

  revalidatePath(`/o/${orgId}`, 'layout')
  return success()
}

export async function removeMember(orgId: string, userId: string): Promise<ActionState> {
  if (!isId(orgId) || !isId(userId)) return INVALID

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('memberships')
    .delete()
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .select('user_id')
  if (error) return failure(toUserMessage(error))
  if (data.length === 0) return failure('Only owners can remove people.')

  revalidatePath(`/o/${orgId}`, 'layout')
  return success()
}

export async function leaveOrganization(orgId: string): Promise<ActionState> {
  if (!isId(orgId)) return INVALID
  const user = await getCurrentUser()
  if (!user) return INVALID

  const supabase = await createClient()
  const { error } = await supabase.from('memberships').delete().eq('org_id', orgId).eq('user_id', user.id)
  if (error) return failure(toUserMessage(error))

  revalidatePath('/', 'layout')
  redirect('/orgs')
}

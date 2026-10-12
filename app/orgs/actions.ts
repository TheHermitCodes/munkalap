'use server'

import { redirect } from 'next/navigation'
import { failure, type ActionState } from '@/lib/action-state'
import { toUserMessage } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { firstIssue, formValues, idSchema, organizationSchema } from '@/lib/validation'

export async function createOrganization(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = organizationSchema.safeParse(formValues(formData))
  if (!parsed.success) return failure(firstIssue(parsed.error))

  const supabase = await createClient()
  // One RPC so the org and the creator's owner membership are created atomically.
  const { data: orgId, error } = await supabase.rpc('create_organization', { org_name: parsed.data.name })
  if (error) return failure(toUserMessage(error))

  redirect(`/o/${orgId}/work-orders`)
}

export async function acceptInvitation(token: string): Promise<ActionState> {
  if (!idSchema.safeParse(token).success) return failure('This invitation link is not valid.')

  const supabase = await createClient()
  const { data: orgId, error } = await supabase.rpc('accept_invitation', { invite_token: token })
  if (error) return failure(toUserMessage(error))

  redirect(`/o/${orgId}/work-orders`)
}

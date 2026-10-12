'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { failure, success, type ActionState } from '@/lib/action-state'
import { safeNextPath } from '@/lib/safe-redirect'
import { createClient } from '@/lib/supabase/server'
import { firstIssue, formValues, signInSchema, signUpSchema } from '@/lib/validation'

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse(formValues(formData))
  if (!parsed.success) return failure(firstIssue(parsed.error))

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    return failure(error.code === 'invalid_credentials' ? 'Wrong email or password.' : error.message)
  }

  redirect(safeNextPath(formData.get('next'), '/'))
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(formValues(formData))
  if (!parsed.success) return failure(firstIssue(parsed.error))

  const next = safeNextPath(formData.get('next'), '/')
  const origin = (await headers()).get('origin') ?? ''

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  })
  if (error) return failure(error.message)

  // With email confirmation on, there's no session until the link is clicked.
  if (!data.session) return success('Check your inbox and click the link to confirm your email address.')
  redirect(next)
}

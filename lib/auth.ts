import 'server-only'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { createClient } from './supabase/server'

export type CurrentUser = { id: string; email: string | null }

/**
 * The verified user for this request, or null. Uses getClaims(), which checks
 * the JWT signature, unlike getSession(), which only decodes the cookie.
 * Cached per request, so layouts and pages can all call it freely.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) return null
  return { id: data.claims.sub, email: data.claims.email ?? null }
})

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/database.types'
import { supabaseKey, supabaseUrl } from './env'

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * It acts as the signed-in user (their JWT comes from the request cookies), so
 * every query is subject to Row Level Security. There is deliberately no
 * service-role client in this app: nothing here needs to bypass RLS.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Server Components can't set cookies. That's fine: proxy.ts refreshes
          // the session on every request before rendering starts.
        }
      },
    },
  })
}

export type ServerClient = Awaited<ReturnType<typeof createClient>>

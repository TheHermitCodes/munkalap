import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/database.types'
import { supabaseKey, supabaseUrl } from './env'

const PUBLIC_PATHS = ['/login', '/auth']

/**
 * Runs before every request: refreshes the Supabase session cookie if the
 * access token has expired, and sends signed-out visitors to /login.
 *
 * The redirect is a UX nicety, not the security boundary. Pages and actions
 * still check the user, and Postgres (RLS) decides what data they can touch.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        // Responses that set auth cookies must not be cached by a CDN.
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
      },
    },
  })

  // Verifies the JWT (and refreshes it if needed). Keep this directly after
  // creating the client so nothing runs with a stale session.
  const { data } = await supabase.auth.getClaims()

  const { pathname, search } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))

  if (!data?.claims && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', pathname + search)
    return NextResponse.redirect(url)
  }

  return response
}

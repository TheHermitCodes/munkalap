import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'
import { supabaseKey, supabaseUrl } from './env'

/**
 * Supabase client for Client Components. Used only where going through the
 * Next.js server would be wasteful, i.e. uploading files straight to Storage.
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseKey)
}

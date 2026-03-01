import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Environment Validation
// ---------------------------------------------------------------------------

function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
      `Ensure it is set in your .env.local (dev) or Vercel project settings (prod).`
    )
  }
  return value
}

// ---------------------------------------------------------------------------
// Client Factories
// ---------------------------------------------------------------------------

let _anonClient: SupabaseClient | null = null

/** Browser-safe Supabase client using the public anon key. Singleton. */
export function getSupabase(): SupabaseClient {
  if (!_anonClient) {
    _anonClient = createClient(
      requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
      requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    )
  }
  return _anonClient
}

/** Server-side Supabase client with service role key. Creates a new instance each call (no session persistence). */
export function createServerClient(): SupabaseClient {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } }
  )
}

import { createBrowserClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/env'

// Browser client, anon key only. RLS is the guard; still filter in every query (ADR-004 rule 4).
export function createClient() {
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey)
}

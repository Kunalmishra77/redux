import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { publicEnv } from '@/lib/env'

// RLS-bound client carrying the user's session — the default for Server Components and Actions.
export async function createClient() {
  const cookieStore = await cookies() // async in Next 16

  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Called from a Server Component, where cookies are read-only. proxy.ts refreshes the
          // session, so dropping the write here is safe.
        }
      },
    },
  })
}

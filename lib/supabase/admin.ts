import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { publicEnv } from '@/lib/env'

// Service role — bypasses RLS. CLAUDE.md rule 3 / BR-X2: server code only. The import above makes
// a client-side import a build error, and CI gate 6 scans client bundles for the key.
// Prefer lib/supabase/server.ts; reach for this only where no user session exists (webhooks,
// the queue worker, cron) or where RLS cannot express the operation.
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')

  return createClient(publicEnv.supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

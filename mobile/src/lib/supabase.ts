import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

// Public values only (the anon key is designed to ship in clients — RLS is the guard).
// The service-role key never comes near this app (CLAUDE.md rule 3).
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const isConfigured = url.startsWith('https://') && anonKey.length > 20

export const supabase = createClient(isConfigured ? url : 'https://not-configured.supabase.co', anonKey || 'missing', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

/** Bucket and path convention: 05-storage-media.md §2 / 04-auth-security-rls.md §5 */
export const PHOTO_BUCKET = 'survey-photos'

export function photoPath(surveyId: string, fittingId: string, slot: string, sha256: string) {
  return `surveys/${surveyId}/${fittingId}/${slot}/${sha256}.jpg`
}

/** Reads the custom-access-token-hook claim without a network call. */
export function roleFromToken(accessToken: string): string | null {
  try {
    const part = accessToken.split('.')[1] ?? ''
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(globalThis.atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)))
    return typeof json.user_role === 'string' ? json.user_role : null
  } catch {
    return null
  }
}

// NEXT_PUBLIC_* values are inlined at build time, so each must be read by its literal name.
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not set — copy .env.example to .env.local`)
  return value
}

export const publicEnv = {
  get supabaseUrl() {
    return required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
  },
  get supabaseAnonKey() {
    return required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  },
}

import type { SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

let clientPromise: Promise<SupabaseClient> | null = null

export function hasStoredAuthSession() {
  if (!isSupabaseConfigured || typeof window === 'undefined') return false
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  return Boolean(localStorage.getItem(`sb-${projectRef}-auth-token`))
}

export function getSupabaseClient() {
  if (!isSupabaseConfigured) {
    return Promise.reject(new Error('Supabase ist noch nicht konfiguriert.'))
  }

  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }),
  )

  return clientPromise
}

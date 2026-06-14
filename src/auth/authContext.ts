import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type AppRole = 'admin' | 'viewer'

export type GuestAccess = {
  roomId: string
  roomTitle: string
  displayName: string
  expiresAt: string
}

export type AuthContextValue = {
  configured: boolean
  loading: boolean
  session: Session | null
  role: AppRole | null
  guestAccess: GuestAccess | null
  signInAdmin: (email: string, password: string) => Promise<void>
  joinWithCode: (code: string, displayName: string) => Promise<void>
  createInvite: (
    title: string,
    validHours: number,
  ) => Promise<{ code: string; expiresAt: string }>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth muss innerhalb AuthProvider laufen.')
  return context
}

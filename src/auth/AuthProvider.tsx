import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import {
  AuthContext,
  type AppRole,
  type GuestAccess,
} from './authContext'

function parseGuestAccess(value: unknown): GuestAccess | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  if (
    typeof data.room_id !== 'string' ||
    typeof data.room_title !== 'string' ||
    typeof data.display_name !== 'string' ||
    typeof data.expires_at !== 'string'
  ) {
    return null
  }
  return {
    roomId: data.room_id,
    roomTitle: data.room_title,
    displayName: data.display_name,
    expiresAt: data.expires_at,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<AppRole | null>(null)
  const [guestAccess, setGuestAccess] = useState<GuestAccess | null>(null)
  const authOperationRef = useRef(0)

  const loadAccess = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession)
    setRole(null)
    setGuestAccess(null)

    if (!supabase || !nextSession) {
      setLoading(false)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', nextSession.user.id)
      .maybeSingle()

    if (profileError) throw profileError
    if (profile?.role === 'admin') {
      setRole('admin')
      setLoading(false)
      return
    }

    const { data: participant, error: participantError } = await supabase
      .from('game_night_participants')
      .select('room_id, display_name, game_nights!inner(title, expires_at)')
      .eq('user_id', nextSession.user.id)
      .gt('game_nights.expires_at', new Date().toISOString())
      .order('joined_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (participantError) throw participantError
    if (participant) {
      const room = participant.game_nights as unknown as {
        title: string
        expires_at: string
      }
      setRole('viewer')
      setGuestAccess({
        roomId: participant.room_id,
        roomTitle: room.title,
        displayName: participant.display_name,
        expiresAt: room.expires_at,
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!supabase) return

    const operation = authOperationRef.current
    supabase.auth.getSession().then(({ data }) => {
      if (authOperationRef.current !== operation) return
      loadAccess(data.session).catch(() => setLoading(false))
    })
  }, [loadAccess])

  const signInAdmin = async (password: string) => {
    if (!supabase) throw new Error('Supabase ist noch nicht konfiguriert.')
    const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
    if (!adminEmail) {
      throw new Error('Die Admin-E-Mail ist noch nicht konfiguriert.')
    }
    authOperationRef.current += 1
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password,
    })
    if (error) {
      setLoading(false)
      throw new Error(
        error.code === 'invalid_credentials'
          ? 'Das Passwort ist falsch.'
          : `Anmeldung fehlgeschlagen: ${error.message}`,
      )
    }
    if (!data.session) {
      setLoading(false)
      throw new Error('Supabase hat keine Sitzung erstellt.')
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.session.user.id)
      .maybeSingle()

    if (profileError || profile?.role !== 'admin') {
      await supabase.auth.signOut()
      setLoading(false)
      throw new Error('Dieses Konto besitzt keine Admin-Rolle.')
    }

    setSession(data.session)
    setGuestAccess(null)
    setRole('admin')
    setLoading(false)
  }

  const requestPasswordReset = async () => {
    if (!supabase) throw new Error('Supabase ist noch nicht konfiguriert.')
    const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
    if (!adminEmail) {
      throw new Error('Die Admin-E-Mail ist noch nicht konfiguriert.')
    }
    const { error } = await supabase.auth.resetPasswordForEmail(adminEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }

  const updatePassword = async (password: string) => {
    if (!supabase) throw new Error('Supabase ist noch nicht konfiguriert.')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
    authOperationRef.current += 1
    await supabase.auth.signOut()
    setSession(null)
    setRole(null)
  }

  const joinWithCode = async (code: string, displayName: string) => {
    if (!supabase) throw new Error('Supabase ist noch nicht konfiguriert.')
    authOperationRef.current += 1
    await supabase.auth.signOut()
    const { data: authData, error: authError } =
      await supabase.auth.signInAnonymously()
    if (authError) throw authError

    const { data, error } = await supabase.rpc('join_game_night', {
      invite_code: code.trim().toUpperCase(),
      participant_name: displayName.trim(),
    })
    if (error) {
      await supabase.auth.signOut()
      throw error
    }

    const access = parseGuestAccess(data)
    if (!access) {
      await supabase.auth.signOut()
      throw new Error('Der Server hat keine gültige Einladung zurückgegeben.')
    }
    setSession(authData.session)
    setRole('viewer')
    setGuestAccess(access)
  }

  const createInvite = async (title: string, validHours: number) => {
    if (!supabase) throw new Error('Supabase ist noch nicht konfiguriert.')
    const { data, error } = await supabase.rpc('create_game_night', {
      room_title: title.trim(),
      valid_hours: validHours,
    })
    if (error) throw error
    const result = data as { code?: unknown; expires_at?: unknown }
    if (
      typeof result.code !== 'string' ||
      typeof result.expires_at !== 'string'
    ) {
      throw new Error('Der Server hat keinen gültigen Invite-Code erstellt.')
    }
    return { code: result.code, expiresAt: result.expires_at }
  }

  const signOut = async () => {
    authOperationRef.current += 1
    if (supabase) await supabase.auth.signOut()
    setSession(null)
    setRole(null)
    setGuestAccess(null)
  }

  const value = {
    configured: isSupabaseConfigured,
    loading,
    session,
    role,
    guestAccess,
    signInAdmin,
    requestPasswordReset,
    updatePassword,
    joinWithCode,
    createInvite,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

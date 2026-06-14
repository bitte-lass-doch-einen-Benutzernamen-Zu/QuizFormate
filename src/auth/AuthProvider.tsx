import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  getSupabaseClient,
  hasStoredAuthSession,
  isSupabaseConfigured,
} from '../lib/supabase'
import {
  AuthContext,
  type AppRole,
  type GuestAccess,
} from './authContext'

const ACCESS_CACHE_KEY = 'quiz-formate-access-v1'

type CachedAccess = {
  userId: string
  role: AppRole
  guestAccess: GuestAccess | null
}

function readCachedAccess(): CachedAccess | null {
  try {
    const value = localStorage.getItem(ACCESS_CACHE_KEY)
    return value ? (JSON.parse(value) as CachedAccess) : null
  } catch {
    localStorage.removeItem(ACCESS_CACHE_KEY)
    return null
  }
}

function writeCachedAccess(access: CachedAccess | null) {
  if (access) {
    localStorage.setItem(ACCESS_CACHE_KEY, JSON.stringify(access))
  } else {
    localStorage.removeItem(ACCESS_CACHE_KEY)
  }
}

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
  const [initialAccess] = useState(readCachedAccess)
  const [loading, setLoading] = useState(
    () =>
      isSupabaseConfigured &&
      hasStoredAuthSession() &&
      !readCachedAccess(),
  )
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<AppRole | null>(
    initialAccess?.role ?? null,
  )
  const [guestAccess, setGuestAccess] = useState<GuestAccess | null>(
    initialAccess?.guestAccess ?? null,
  )
  const authOperationRef = useRef(0)

  const loadAccess = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession)

    if (!nextSession) {
      setRole(null)
      setGuestAccess(null)
      writeCachedAccess(null)
      setLoading(false)
      return
    }

    const client = await getSupabaseClient()
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('role')
      .eq('id', nextSession.user.id)
      .maybeSingle()

    if (profileError) throw profileError
    if (profile?.role === 'admin') {
      setRole('admin')
      setGuestAccess(null)
      writeCachedAccess({
        userId: nextSession.user.id,
        role: 'admin',
        guestAccess: null,
      })
      setLoading(false)
      return
    }

    const { data: participant, error: participantError } = await client
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
      const nextGuestAccess = {
        roomId: participant.room_id,
        roomTitle: room.title,
        displayName: participant.display_name,
        expiresAt: room.expires_at,
      }
      setGuestAccess(nextGuestAccess)
      writeCachedAccess({
        userId: nextSession.user.id,
        role: 'viewer',
        guestAccess: nextGuestAccess,
      })
    } else {
      setRole(null)
      setGuestAccess(null)
      writeCachedAccess(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) return

    const operation = authOperationRef.current
    getSupabaseClient().then((client) => client.auth.getSession()).then(({ data }) => {
      if (authOperationRef.current !== operation) return
      loadAccess(data.session).catch(() => setLoading(false))
    }).catch(() => setLoading(false))
  }, [loadAccess])

  const signInAdmin = async (password: string) => {
    const client = await getSupabaseClient()
    const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
    if (!adminEmail) {
      throw new Error('Die Admin-E-Mail ist noch nicht konfiguriert.')
    }
    authOperationRef.current += 1
    setLoading(true)
    const { data, error } = await client.auth.signInWithPassword({
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

    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('role')
      .eq('id', data.session.user.id)
      .maybeSingle()

    if (profileError || profile?.role !== 'admin') {
      await client.auth.signOut()
      setLoading(false)
      throw new Error('Dieses Konto besitzt keine Admin-Rolle.')
    }

    setSession(data.session)
    setGuestAccess(null)
    setRole('admin')
    writeCachedAccess({
      userId: data.session.user.id,
      role: 'admin',
      guestAccess: null,
    })
    setLoading(false)
  }

  const requestPasswordReset = async () => {
    const client = await getSupabaseClient()
    const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
    if (!adminEmail) {
      throw new Error('Die Admin-E-Mail ist noch nicht konfiguriert.')
    }
    const { error } = await client.auth.resetPasswordForEmail(adminEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }

  const updatePassword = async (password: string) => {
    const client = await getSupabaseClient()
    const { error } = await client.auth.updateUser({ password })
    if (error) throw error
    authOperationRef.current += 1
    await client.auth.signOut()
    setSession(null)
    setRole(null)
    setGuestAccess(null)
    writeCachedAccess(null)
  }

  const joinWithCode = async (code: string, displayName: string) => {
    const client = await getSupabaseClient()
    authOperationRef.current += 1
    await client.auth.signOut()
    const { data: authData, error: authError } =
      await client.auth.signInAnonymously()
    if (authError) throw authError
    if (!authData.user || !authData.session) {
      throw new Error('Supabase hat keine Gastsitzung erstellt.')
    }

    const { data, error } = await client.rpc('join_game_night', {
      invite_code: code.trim().toUpperCase(),
      participant_name: displayName.trim(),
    })
    if (error) {
      await client.auth.signOut()
      throw error
    }

    const access = parseGuestAccess(data)
    if (!access) {
      await client.auth.signOut()
      throw new Error('Der Server hat keine gültige Einladung zurückgegeben.')
    }
    setSession(authData.session)
    setRole('viewer')
    setGuestAccess(access)
    writeCachedAccess({
      userId: authData.user.id,
      role: 'viewer',
      guestAccess: access,
    })
  }

  const createInvite = async (title: string, validHours: number) => {
    const client = await getSupabaseClient()
    const { data, error } = await client.rpc('create_game_night', {
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
    if (isSupabaseConfigured) {
      const client = await getSupabaseClient()
      await client.auth.signOut()
    }
    setSession(null)
    setRole(null)
    setGuestAccess(null)
    writeCachedAccess(null)
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

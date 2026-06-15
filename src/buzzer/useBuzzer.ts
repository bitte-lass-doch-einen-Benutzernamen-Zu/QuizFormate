import { useCallback, useEffect, useState } from 'react'
import { getSupabaseClient } from '../lib/supabase'

export type BuzzerState = {
  roomId: string
  isOpen: boolean
  winnerUserId: string | null
  winnerName: string | null
  buzzedAt: string | null
  updatedAt: string
}

type BuzzerRow = {
  room_id: string
  is_open: boolean
  winner_user_id: string | null
  winner_name: string | null
  buzzed_at: string | null
  updated_at: string
}

function parseBuzzerState(value: unknown): BuzzerState {
  const row = value as BuzzerRow
  return {
    roomId: row.room_id,
    isOpen: row.is_open,
    winnerUserId: row.winner_user_id,
    winnerName: row.winner_name,
    buzzedAt: row.buzzed_at,
    updatedAt: row.updated_at,
  }
}

function getBuzzerError(reason: unknown) {
  if (
    reason &&
    typeof reason === 'object' &&
    'code' in reason &&
    reason.code === 'PGRST205'
  ) {
    return 'Der Live-Buzzer ist in Supabase noch nicht eingerichtet. Führe die Migration 202606150001_live_buzzer.sql aus.'
  }
  return reason instanceof Error
    ? reason.message
    : 'Buzzer konnte nicht geladen werden.'
}

export function useBuzzer(roomId: string | undefined) {
  const [state, setState] = useState<BuzzerState | null>(null)
  const [loading, setLoading] = useState(Boolean(roomId))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!roomId) return

    let active = true
    let cleanup = () => {}

    getSupabaseClient()
      .then(async (client) => {
        if (!active) return
        setLoading(true)
        setError('')
        const { data, error: loadError } = await client
          .from('buzzer_states')
          .select('*')
          .eq('room_id', roomId)
          .single()

        if (loadError) throw loadError
        if (!active) return
        setState(parseBuzzerState(data))
        setLoading(false)

        const channel = client
          .channel(`buzzer:${roomId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'buzzer_states',
              filter: `room_id=eq.${roomId}`,
            },
            (payload) => setState(parseBuzzerState(payload.new)),
          )
          .subscribe()

        cleanup = () => {
          void client.removeChannel(channel)
        }
      })
      .catch((reason) => {
        if (!active) return
        setLoading(false)
        setError(getBuzzerError(reason))
      })

    return () => {
      active = false
      cleanup()
    }
  }, [roomId])

  const runAction = useCallback(
    async (functionName: 'press_buzzer' | 'control_buzzer', action?: string) => {
      if (!roomId || busy) return null
      setBusy(true)
      setError('')
      try {
        const client = await getSupabaseClient()
        const args =
          functionName === 'press_buzzer'
            ? { check_room_id: roomId }
            : { check_room_id: roomId, buzzer_action: action }
        const { data, error: actionError } = await client.rpc(functionName, args)
        if (actionError) throw actionError
        const nextState = parseBuzzerState(data)
        setState(nextState)
        return data as { claimed?: boolean }
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'Buzzer-Aktion fehlgeschlagen.',
        )
        return null
      } finally {
        setBusy(false)
      }
    },
    [busy, roomId],
  )

  const currentState = state?.roomId === roomId ? state : null

  return {
    state: currentState,
    loading: Boolean(roomId) && loading,
    busy,
    error,
    press: () => runAction('press_buzzer'),
    open: () => runAction('control_buzzer', 'open'),
    lock: () => runAction('control_buzzer', 'lock'),
    reset: () => runAction('control_buzzer', 'reset'),
  }
}

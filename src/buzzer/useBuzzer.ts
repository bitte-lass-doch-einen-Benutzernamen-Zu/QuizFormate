import { useCallback, useEffect, useState } from 'react'
import { getSupabaseClient } from '../lib/supabase'

export type BuzzerEntry = {
  userId: string
  displayName: string
  position: number
  buzzedAt: string
}

export type RoomTextEntry = {
  userId: string
  displayName: string
  content: string
  submittedAt: string
}

export type BuzzerState = {
  roomId: string
  isOpen: boolean
  buzzerVisible: boolean
  textInputVisible: boolean
  winnerUserId: string | null
  winnerName: string | null
  buzzedAt: string | null
  updatedAt: string
  queue: BuzzerEntry[]
  textEntries: RoomTextEntry[]
}

type BuzzerPayload = {
  room_id: string
  is_open: boolean
  buzzer_visible: boolean
  text_input_visible: boolean
  winner_user_id: string | null
  winner_name: string | null
  buzzed_at: string | null
  updated_at: string
  queue?: {
    user_id: string
    display_name: string
    position: number
    buzzed_at: string
  }[]
  text_entries?: {
    user_id: string
    display_name: string
    content: string
    submitted_at: string
  }[]
}

function parseBuzzerState(value: unknown): BuzzerState {
  const payload = value as BuzzerPayload
  return {
    roomId: payload.room_id,
    isOpen: payload.is_open,
    buzzerVisible: payload.buzzer_visible,
    textInputVisible: payload.text_input_visible,
    winnerUserId: payload.winner_user_id,
    winnerName: payload.winner_name,
    buzzedAt: payload.buzzed_at,
    updatedAt: payload.updated_at,
    queue: (payload.queue ?? []).map((entry) => ({
      userId: entry.user_id,
      displayName: entry.display_name,
      position: entry.position,
      buzzedAt: entry.buzzed_at,
    })),
    textEntries: (payload.text_entries ?? []).map((entry) => ({
      userId: entry.user_id,
      displayName: entry.display_name,
      content: entry.content,
      submittedAt: entry.submitted_at,
    })),
  }
}

function getBuzzerError(reason: unknown) {
  if (
    reason &&
    typeof reason === 'object' &&
    'code' in reason &&
    reason.code === 'PGRST205'
  ) {
    return 'Der Live-Buzzer ist in Supabase noch nicht eingerichtet.'
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

        const loadSnapshot = async () => {
          const { data, error: loadError } = await client.rpc(
            'buzzer_snapshot',
            { check_room_id: roomId },
          )
          if (loadError) throw loadError
          if (active) setState(parseBuzzerState(data))
        }

        await loadSnapshot()
        if (!active) return
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
            () => {
              void loadSnapshot().catch((reason) => {
                if (active) setError(getBuzzerError(reason))
              })
            },
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
        setState(parseBuzzerState(data))
        return data as { position?: number }
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

  const runRpc = useCallback(
    async (functionName: string, args: Record<string, unknown>) => {
      if (!roomId || busy) return null
      setBusy(true)
      setError('')
      try {
        const client = await getSupabaseClient()
        const { data, error: actionError } = await client.rpc(functionName, args)
        if (actionError) throw actionError
        setState(parseBuzzerState(data))
        return data
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'Raum-Aktion fehlgeschlagen.',
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
    setFeature: (feature: 'buzzer' | 'text', enabled: boolean) =>
      runRpc('control_room_feature', {
        check_room_id: roomId,
        feature_name: feature,
        enabled,
      }),
    submitText: (content: string) =>
      runRpc('submit_room_text', {
        check_room_id: roomId,
        submitted_text: content,
      }),
    clearTexts: () =>
      runRpc('clear_room_texts', { check_room_id: roomId }),
  }
}

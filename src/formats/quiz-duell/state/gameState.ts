import { useCallback, useEffect, useRef, useState } from 'react'

export type Team = {
  id: string
  name: string
  members: string[]
  score: number
  color: string
}

export type GameState = {
  teams: Team[]
  activeTeamIndex: number
  activeBoardId: string
  playedQuestionIds: string[]
  questionResults: Record<
    string,
    { adjustments: { teamId: string; scoreDelta: number }[] }
  >
  activeQuestionId: string | null
  answerVisible: boolean
  pendingSteal: {
    questionId: string
    originalTeamId: string
    penalty: number
  } | null
  feedback: {
    type: 'correct' | 'wrong'
    timestamp: number
  } | null
  gameFinished: boolean
}

const STORAGE_KEY = 'quiz-duell-game-v2'
const CHANNEL_NAME = 'quiz-duell-sync'
const colors = ['#00f5d4', '#ff4ecd', '#a78bfa', '#ffb703', '#4cc9f0', '#72ef36']

export const initialGame: GameState = {
  teams: [
    { id: 'team-1', name: 'Team 1', members: [], score: 0, color: colors[0] },
    { id: 'team-2', name: 'Team 2', members: [], score: 0, color: colors[1] },
  ],
  activeTeamIndex: 0,
  activeBoardId: 'board-1',
  playedQuestionIds: [],
  questionResults: {},
  activeQuestionId: null,
  answerVisible: false,
  pendingSteal: null,
  feedback: null,
  gameFinished: false,
}

function readGame(): GameState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as GameState
      const legacyResults = parsed.questionResults as unknown as Record<
        string,
        { teamId?: string; scoreDelta?: number; adjustments?: { teamId: string; scoreDelta: number }[] }
      >
      const questionResults = Object.fromEntries(
        Object.entries(legacyResults ?? {}).map(([questionId, result]) => [
          questionId,
          {
            adjustments:
              result.adjustments ??
              (result.teamId && typeof result.scoreDelta === 'number'
                ? [{ teamId: result.teamId, scoreDelta: result.scoreDelta }]
                : []),
          },
        ]),
      )
      return {
        ...parsed,
        activeBoardId: parsed.activeBoardId ?? 'board-1',
        questionResults,
        pendingSteal: parsed.pendingSteal ?? null,
        feedback: null,
        gameFinished: parsed.gameFinished ?? false,
      }
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY)
  }
  return initialGame
}

export function createTeam(index: number): Team {
  return {
    id: `team-${Date.now()}-${index}`,
    name: `Team ${index + 1}`,
    members: [],
    score: 0,
    color: colors[index % colors.length],
  }
}

export function useGameState() {
  const [game, setGameState] = useState<GameState>(readGame)
  const channelRef = useRef<BroadcastChannel | null>(null)

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME)
    channelRef.current = channel
    const receive = (event: MessageEvent<GameState>) => setGameState(event.data)
    const receiveStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        setGameState(JSON.parse(event.newValue) as GameState)
      }
    }
    channel.addEventListener('message', receive)
    window.addEventListener('storage', receiveStorage)
    return () => {
      channel.removeEventListener('message', receive)
      channel.close()
      channelRef.current = null
      window.removeEventListener('storage', receiveStorage)
    }
  }, [])

  const setGame = useCallback(
    (update: GameState | ((current: GameState) => GameState)) => {
      setGameState((current) => {
        const next = typeof update === 'function' ? update(current) : update
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        channelRef.current?.postMessage(next)
        return next
      })
    },
    [],
  )

  return [game, setGame] as const
}

import { useEffect, useMemo, useState } from 'react'
import { allQuestions, boards } from '../data/questions'
import {
  createTeam,
  initialGame,
  useGameState,
  type GameState,
} from '../state/gameState'

type GameUpdater = GameState | ((current: GameState) => GameState)

function addPlayedQuestion(questionIds: string[], questionId: string) {
  return questionIds.includes(questionId)
    ? questionIds
    : [...questionIds, questionId]
}

export function useQuizDuellGame() {
  const [game, setGame] = useGameState()
  const [teamManagerOpen, setTeamManagerOpen] = useState(false)
  const [memberDrafts, setMemberDrafts] = useState<Record<string, string>>({})

  const activeTeam = game.teams[game.activeTeamIndex] ?? game.teams[0]
  const activeBoard = useMemo(
    () => boards.find((board) => board.id === game.activeBoardId) ?? boards[0],
    [game.activeBoardId],
  )
  const activeQuestion = useMemo(
    () =>
      allQuestions.find((question) => question.id === game.activeQuestionId),
    [game.activeQuestionId],
  )
  const boardQuestions = useMemo(
    () =>
      activeBoard.categories.flatMap((category) => category.questions),
    [activeBoard],
  )
  const playedQuestionIds = useMemo(
    () => new Set(game.playedQuestionIds),
    [game.playedQuestionIds],
  )
  const playedOnBoard = useMemo(
    () =>
      boardQuestions.filter((question) => playedQuestionIds.has(question.id))
        .length,
    [boardQuestions, playedQuestionIds],
  )
  const { highestScore, winners, standings } = useMemo(() => {
    const nextHighestScore = Math.max(
      ...game.teams.map((team) => team.score),
    )
    return {
      highestScore: nextHighestScore,
      winners: game.teams.filter((team) => team.score === nextHighestScore),
      standings: [...game.teams].sort((a, b) => b.score - a.score),
    }
  }, [game.teams])

  useEffect(() => {
    if (!game.feedback) return
    const timestamp = game.feedback.timestamp
    const timer = window.setTimeout(() => {
      setGame((current) =>
        current.feedback?.timestamp === timestamp
          ? { ...current, feedback: null }
          : current,
      )
    }, 650)
    return () => window.clearTimeout(timer)
  }, [game.feedback, setGame])

  const updateGame = (update: GameUpdater) => setGame(update)

  const openQuestion = (questionId: string) => {
    setGame((current) => ({
      ...current,
      activeQuestionId: questionId,
      answerVisible: false,
      pendingSteal: null,
    }))
  }

  const closeQuestion = () => {
    setGame((current) => ({
      ...current,
      activeQuestionId: null,
      answerVisible: false,
      pendingSteal: null,
    }))
  }

  const finishQuestion = (correct: boolean) => {
    if (!activeQuestion) return
    setGame((current) => {
      const team = current.teams[current.activeTeamIndex]
      const scoreDelta = correct
        ? activeQuestion.points
        : -Math.round(activeQuestion.points / 2)
      return {
        ...current,
        teams: current.teams.map((currentTeam, index) =>
          index === current.activeTeamIndex
            ? { ...currentTeam, score: currentTeam.score + scoreDelta }
            : currentTeam,
        ),
        activeTeamIndex: (current.activeTeamIndex + 1) % current.teams.length,
        playedQuestionIds: addPlayedQuestion(
          current.playedQuestionIds,
          activeQuestion.id,
        ),
        questionResults: {
          ...current.questionResults,
          [activeQuestion.id]: {
            adjustments: [{ teamId: team.id, scoreDelta }],
          },
        },
        activeQuestionId: null,
        answerVisible: false,
        pendingSteal: null,
        feedback: correct
          ? null
          : { type: 'wrong' as const, timestamp: Date.now() },
      }
    })
  }

  const startSteal = () => {
    if (!activeQuestion) return
    setGame((current) => {
      const originalTeam = current.teams[current.activeTeamIndex]
      const penalty = -Math.round(activeQuestion.points / 2)
      return {
        ...current,
        teams: current.teams.map((team) =>
          team.id === originalTeam.id
            ? { ...team, score: team.score + penalty }
            : team,
        ),
        pendingSteal: {
          questionId: activeQuestion.id,
          originalTeamId: originalTeam.id,
          penalty,
        },
        feedback: { type: 'wrong', timestamp: Date.now() },
      }
    })
  }

  const finishSteal = (stealingTeamId: string | null) => {
    if (!activeQuestion || !game.pendingSteal) return
    setGame((current) => {
      if (!current.pendingSteal) return current
      const reward = stealingTeamId
        ? Math.round(activeQuestion.points / 2)
        : 0
      const adjustments = [
        {
          teamId: current.pendingSteal.originalTeamId,
          scoreDelta: current.pendingSteal.penalty,
        },
        ...(stealingTeamId
          ? [{ teamId: stealingTeamId, scoreDelta: reward }]
          : []),
      ]
      return {
        ...current,
        teams: current.teams.map((team) =>
          team.id === stealingTeamId
            ? { ...team, score: team.score + reward }
            : team,
        ),
        activeTeamIndex: (current.activeTeamIndex + 1) % current.teams.length,
        playedQuestionIds: addPlayedQuestion(
          current.playedQuestionIds,
          activeQuestion.id,
        ),
        questionResults: {
          ...current.questionResults,
          [activeQuestion.id]: { adjustments },
        },
        activeQuestionId: null,
        answerVisible: false,
        pendingSteal: null,
        feedback: null,
      }
    })
  }

  const restoreQuestion = (questionId: string) => {
    setGame((current) => {
      const result = current.questionResults[questionId]
      const questionResults = { ...current.questionResults }
      delete questionResults[questionId]
      return {
        ...current,
        teams: result
          ? current.teams.map((team) => {
              const appliedScore = result.adjustments
                .filter((adjustment) => adjustment.teamId === team.id)
                .reduce((sum, adjustment) => sum + adjustment.scoreDelta, 0)
              return appliedScore
                ? { ...team, score: team.score - appliedScore }
                : team
            })
          : current.teams,
        activeTeamIndex: result?.adjustments[0]
          ? Math.max(
              0,
              current.teams.findIndex(
                (team) => team.id === result.adjustments[0].teamId,
              ),
            )
          : current.activeTeamIndex,
        playedQuestionIds: current.playedQuestionIds.filter(
          (id) => id !== questionId,
        ),
        questionResults,
        pendingSteal:
          current.pendingSteal?.questionId === questionId
            ? null
            : current.pendingSteal,
      }
    })
  }

  const updateTeam = (
    teamId: string,
    update: (team: GameState['teams'][number]) => GameState['teams'][number],
  ) => {
    setGame((current) => ({
      ...current,
      teams: current.teams.map((team) =>
        team.id === teamId ? update(team) : team,
      ),
    }))
  }

  const adjustScore = (teamId: string, amount: number) => {
    updateTeam(teamId, (team) => ({ ...team, score: team.score + amount }))
  }

  const updateTeamName = (teamId: string, name: string) => {
    updateTeam(teamId, (team) => ({ ...team, name }))
  }

  const addMember = (teamId: string) => {
    const name = memberDrafts[teamId]?.trim()
    if (!name) return
    updateTeam(teamId, (team) => ({
      ...team,
      members: [...team.members, name],
    }))
    setMemberDrafts((current) => ({ ...current, [teamId]: '' }))
  }

  const removeMember = (teamId: string, memberIndex: number) => {
    updateTeam(teamId, (team) => ({
      ...team,
      members: team.members.filter((_, index) => index !== memberIndex),
    }))
  }

  const addTeam = () => {
    if (game.teams.length >= 6) return
    setGame((current) => ({
      ...current,
      teams: [...current.teams, createTeam(current.teams.length)],
    }))
  }

  const removeTeam = (teamId: string) => {
    if (game.teams.length <= 2) return
    setGame((current) => {
      const teams = current.teams.filter((team) => team.id !== teamId)
      return {
        ...current,
        teams,
        activeTeamIndex: Math.min(current.activeTeamIndex, teams.length - 1),
      }
    })
  }

  const resetGame = () => {
    if (!window.confirm('Komplettes Spiel inklusive Teams zurücksetzen?')) return
    setGame(initialGame)
  }

  const finishGame = () => {
    if (!window.confirm('Spiel beenden und Gewinner anzeigen?')) return
    setGame((current) => ({
      ...current,
      activeQuestionId: null,
      answerVisible: false,
      pendingSteal: null,
      feedback: null,
      gameFinished: true,
    }))
  }

  return {
    game,
    updateGame,
    activeTeam,
    activeBoard,
    activeQuestion,
    totalQuestions: boardQuestions.length,
    playedOnBoard,
    highestScore,
    winners,
    standings,
    teamManagerOpen,
    setTeamManagerOpen,
    memberDrafts,
    setMemberDrafts,
    openQuestion,
    closeQuestion,
    finishQuestion,
    startSteal,
    finishSteal,
    restoreQuestion,
    adjustScore,
    updateTeamName,
    addMember,
    removeMember,
    addTeam,
    removeTeam,
    resetGame,
    finishGame,
  }
}

export type QuizDuellController = ReturnType<typeof useQuizDuellGame>

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../auth/authContext'
import { useBuzzer, type RoomParticipant } from '../../../buzzer/useBuzzer'
import {
  fallbackDdfQuestions,
  loadDdfQuestionBatch,
  type DdfQuestion,
} from '../api/ddfQuestions'
import '../styles/duemmste-fliegt.css'

type PlayerStats = {
  lives: number
  score: number
  out: boolean
}

type LocalPlayer = {
  id: string
  name: string
}

const maxLives = 3
const roundSeconds = 29

const demoPlayers: LocalPlayer[] = [
  { id: 'local-1', name: 'Team Cyan' },
  { id: 'local-2', name: 'Team Pink' },
  { id: 'local-3', name: 'Team Gelb' },
]

function createPlayer(): LocalPlayer {
  return {
    id: crypto.randomUUID(),
    name: `Spieler ${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
  }
}

function createStats(): PlayerStats {
  return { lives: maxLives, score: 0, out: false }
}

function formatTime(seconds: number) {
  return `00:${String(seconds).padStart(2, '0')}`
}

function createMeetingUrl(roomId: string | undefined) {
  const roomName = encodeURIComponent(`quiz-formate-ddf-${roomId ?? 'demo'}`)
  return `https://meet.jit.si/${roomName}#config.prejoinPageEnabled=false&config.startWithAudioMuted=true`
}

export default function DuemmsteFliegtPage() {
  const { activeRoom } = useAuth()
  const room = useBuzzer(activeRoom?.roomId)
  const [localPlayers, setLocalPlayers] = useState(demoPlayers)
  const [statsById, setStatsById] = useState<Record<string, PlayerStats>>({})
  const [questions, setQuestions] = useState<DdfQuestion[]>(fallbackDdfQuestions)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [round, setRound] = useState(1)
  const [secondsLeft, setSecondsLeft] = useState(roundSeconds)
  const [timerRunning, setTimerRunning] = useState(false)
  const [answerVisible, setAnswerVisible] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(Boolean(activeRoom))
  const [questionLoading, setQuestionLoading] = useState(false)
  const [questionError, setQuestionError] = useState('')

  const players = useMemo(
    () => {
      if (activeRoom) {
        return (room.state?.participants ?? []).map((participant) => ({
            id: participant.userId,
            name: participant.displayName,
            participant,
          }))
      }

      return localPlayers.map((player) => ({ ...player, participant: null }))
    },
    [activeRoom, localPlayers, room.state?.participants],
  )

  const activeQuestion = questions[questionIndex] ?? fallbackDdfQuestions[0]
  const timerActive = timerRunning && secondsLeft > 0
  const meetingUrl = createMeetingUrl(activeRoom?.roomId)
  const activeCount = players.filter(
    (player) => !(statsById[player.id] ?? createStats()).out,
  ).length

  useEffect(() => {
    if (!timerActive) return
    const interval = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1))
    }, 1000)
    return () => window.clearInterval(interval)
  }, [timerActive])

  const getStats = (id: string) => statsById[id] ?? createStats()

  const updateStats = (id: string, update: (stats: PlayerStats) => PlayerStats) => {
    setStatsById((current) => ({
      ...current,
      [id]: update(current[id] ?? createStats()),
    }))
  }

  const loseLife = (id: string) => {
    updateStats(id, (stats) => {
      const lives = Math.max(0, stats.lives - 1)
      return { ...stats, lives, out: lives === 0 }
    })
  }

  const removePlayer = (id: string, participant: RoomParticipant | null) => {
    if (participant) {
      if (!window.confirm(`${participant.displayName} aus dem Raum entfernen?`)) {
        return
      }
      void room.removeParticipant(participant.userId)
      return
    }
    setLocalPlayers((current) => current.filter((player) => player.id !== id))
  }

  const resetRound = () => {
    setSecondsLeft(roundSeconds)
    setTimerRunning(false)
    setAnswerVisible(false)
  }

  const nextQuestion = () => {
    setQuestionIndex((current) => (current + 1) % questions.length)
    setRound((current) => current + 1)
    resetRound()
  }

  const resetGame = () => {
    setStatsById({})
    setQuestionIndex(0)
    setRound(1)
    resetRound()
  }

  const loadOnlineQuestions = async () => {
    setQuestionLoading(true)
    setQuestionError('')
    try {
      const batches = await Promise.all([
        loadDdfQuestionBatch(50),
        loadDdfQuestionBatch(50),
        loadDdfQuestionBatch(50),
        loadDdfQuestionBatch(50),
      ])
      const merged = new Map<string, DdfQuestion>()
      for (const question of [...fallbackDdfQuestions, ...batches.flat()]) {
        merged.set(question.id, question)
      }
      setQuestions([...merged.values()])
      setQuestionIndex(0)
      resetRound()
    } catch (error) {
      setQuestionError(
        error instanceof Error
          ? error.message
          : 'Online-Fragen konnten nicht geladen werden.',
      )
    } finally {
      setQuestionLoading(false)
    }
  }

  return (
    <main className="ddf-page">
      <header className="ddf-topbar">
        <a href="/">Zurueck</a>
        <div className="ddf-title">
          <span>Der Duemmste fliegt</span>
          <strong>Host-Konsole</strong>
        </div>
        <div className="ddf-meta">
          <span>Runde {round}</span>
          <b>{formatTime(secondsLeft)}</b>
          <em>{questions.length} Fragen</em>
        </div>
      </header>

      <section className="ddf-layout">
        <section className="ddf-stage" aria-label="Kandidaten">
          {players.map((player, index) => {
            const stats = getStats(player.id)
            return (
              <article
                className={`ddf-player-card${stats.out ? ' out' : ''}${
                  stats.lives === 1 && !stats.out ? ' danger' : ''
                }`}
                key={player.id}
              >
                <div className="ddf-player-main">
                  <div className="ddf-avatar">{player.name.slice(0, 1)}</div>
                  <div>
                    <span>Slot {index + 1}</span>
                    {activeRoom ? (
                      <strong>{player.name}</strong>
                    ) : (
                      <input
                        aria-label="Name"
                        onChange={(event) =>
                          setLocalPlayers((current) =>
                            current.map((item) =>
                              item.id === player.id
                                ? { ...item, name: event.target.value }
                                : item,
                            ),
                          )
                        }
                        value={player.name}
                      />
                    )}
                    <small>{stats.score} Punkte</small>
                  </div>
                </div>

                <div className="ddf-lives" aria-label={`${stats.lives} Leben`}>
                  {Array.from({ length: maxLives }, (_, lifeIndex) => (
                    <span
                      className={lifeIndex < stats.lives ? 'active' : ''}
                      key={lifeIndex}
                    >
                      {'\u2665'}
                    </span>
                  ))}
                </div>

                <div className="ddf-card-actions">
                  <button
                    onClick={() =>
                      updateStats(player.id, (current) => ({
                        ...current,
                        score: current.score + 1,
                      }))
                    }
                    type="button"
                  >
                    + Punkt
                  </button>
                  <button onClick={() => loseLife(player.id)} type="button">
                    Leben -
                  </button>
                  <button
                    onClick={() =>
                      updateStats(player.id, (current) => ({
                        ...current,
                        out: !current.out,
                        lives: current.out ? 1 : 0,
                      }))
                    }
                    type="button"
                  >
                    {stats.out ? 'Zurueck' : 'Raus'}
                  </button>
                  <button
                    className="danger"
                    onClick={() => removePlayer(player.id, player.participant)}
                    type="button"
                  >
                    Loeschen
                  </button>
                </div>
              </article>
            )
          })}
        </section>

        <aside className="ddf-control-panel" aria-label="Spielleitung">
          <div>
            <span>Im Spiel</span>
            <strong>{activeCount}</strong>
          </div>
          <button
            onClick={() => {
              if (secondsLeft === 0) setSecondsLeft(roundSeconds)
              setTimerRunning((running) => !running)
            }}
            type="button"
          >
            {timerActive ? 'Timer pausieren' : 'Timer starten'}
          </button>
          <button
            onClick={() => setAnswerVisible((visible) => !visible)}
            type="button"
          >
            {answerVisible ? 'Antwort ausblenden' : 'Antwort zeigen'}
          </button>
          <button onClick={nextQuestion} type="button">
            Naechste Frage
          </button>
          <button
            disabled={questionLoading}
            onClick={loadOnlineQuestions}
            type="button"
          >
            {questionLoading ? 'Laedt...' : '200 Online-Fragen'}
          </button>
          {!activeRoom && (
            <button
              onClick={() => setLocalPlayers((current) => [...current, createPlayer()])}
              type="button"
            >
              Spieler +
            </button>
          )}
          <button onClick={() => setCameraOpen((open) => !open)} type="button">
            {cameraOpen ? 'Kameras ausblenden' : 'Kameras anzeigen'}
          </button>
          <button onClick={resetGame} type="button">
            Reset
          </button>
          {!activeRoom && (
            <p>Erstelle eine Einladung, damit echte Teilnehmer hier erscheinen.</p>
          )}
          {questionError && <p role="alert">{questionError}</p>}
        </aside>
      </section>

      <section className="ddf-question-bar">
        <div className="ddf-question-mark">?</div>
        <div>
          <span>
            {activeQuestion.category} · {activeQuestion.source === 'api' ? 'API' : 'Fallback'}
          </span>
          <h1>{activeQuestion.prompt}</h1>
          {answerVisible && <strong>{activeQuestion.answer}</strong>}
        </div>
      </section>

      {cameraOpen && (
        <section className="ddf-camera-room">
          <div>
            <span>Kamera-Raum</span>
            <strong>Gaeste oeffnen denselben Raum in ihrer Viewer-UI.</strong>
          </div>
          <iframe
            allow="camera; microphone; fullscreen; display-capture"
            src={meetingUrl}
            title="Der Duemmste fliegt Kamera-Raum"
          />
        </section>
      )}
    </main>
  )
}

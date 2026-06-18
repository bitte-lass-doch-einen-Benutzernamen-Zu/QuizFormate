import { useEffect, useMemo, useRef, useState } from 'react'
import '../styles/duemmste-fliegt.css'

type Player = {
  id: string
  name: string
  lives: number
  status: 'safe' | 'danger' | 'out'
  score: number
}

type Question = {
  prompt: string
  answer: string
  category: string
}

const maxLives = 3
const roundSeconds = 29

const initialPlayers: Player[] = [
  { id: 'p1', name: 'Schmobin', lives: 3, status: 'safe', score: 0 },
  { id: 'p2', name: 'Elquaria', lives: 3, status: 'safe', score: 0 },
  { id: 'p3', name: 'Filbi', lives: 3, status: 'safe', score: 0 },
  { id: 'p4', name: 'HamedLoco', lives: 2, status: 'danger', score: 0 },
  { id: 'p5', name: 'Huytastic', lives: 3, status: 'safe', score: 0 },
  { id: 'p6', name: 'LetsHugoTV', lives: 3, status: 'safe', score: 0 },
  { id: 'p7', name: 'notGambo', lives: 2, status: 'danger', score: 0 },
  { id: 'p8', name: 'Rosemondy', lives: 3, status: 'safe', score: 0 },
  { id: 'p9', name: 'Wichtiger', lives: 3, status: 'safe', score: 0 },
]

const questions: Question[] = [
  {
    category: 'Psychologie',
    prompt:
      'Wie ist der Begriff fuer Geiseln, die Verstaendnis fuer ihre Entfuehrer haben?',
    answer: 'Stockholm-Syndrom',
  },
  {
    category: 'Allgemeinwissen',
    prompt: 'Welcher Planet ist der Sonne am naechsten?',
    answer: 'Merkur',
  },
  {
    category: 'Sprache',
    prompt: 'Wie nennt man ein Wort, das rueckwaerts und vorwaerts gleich ist?',
    answer: 'Palindrom',
  },
  {
    category: 'Internet',
    prompt: 'Wofuer steht die Abkuerzung URL?',
    answer: 'Uniform Resource Locator',
  },
  {
    category: 'Games',
    prompt: 'Welche Farbe hat der seltenste Edelstein in Minecraft: Diamant?',
    answer: 'Hellblau',
  },
]

function createPlayer(): Player {
  const id = crypto.randomUUID()
  return {
    id,
    name: `Spieler ${id.slice(0, 4).toUpperCase()}`,
    lives: maxLives,
    status: 'safe',
    score: 0,
  }
}

function formatTime(seconds: number) {
  return `00:${String(seconds).padStart(2, '0')}`
}

export default function DuemmsteFliegtPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [players, setPlayers] = useState(initialPlayers)
  const [round, setRound] = useState(3)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(roundSeconds)
  const [timerRunning, setTimerRunning] = useState(false)
  const [answerVisible, setAnswerVisible] = useState(false)
  const [cameraPlayerId, setCameraPlayerId] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState('')

  const activeQuestion = questions[questionIndex]
  const timerActive = timerRunning && secondsLeft > 0
  const activePlayers = useMemo(
    () => players.filter((player) => player.status !== 'out'),
    [players],
  )

  useEffect(() => {
    if (!timerActive) return

    const interval = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1))
    }, 1000)

    return () => window.clearInterval(interval)
  }, [timerActive])

  useEffect(() => {
    const video = videoRef.current
    if (video) video.srcObject = streamRef.current
  }, [cameraPlayerId])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const updatePlayer = (id: string, update: Partial<Player>) => {
    setPlayers((current) =>
      current.map((player) =>
        player.id === id ? { ...player, ...update } : player,
      ),
    )
  }

  const loseLife = (id: string) => {
    setPlayers((current) =>
      current.map((player) => {
        if (player.id !== id || player.status === 'out') return player
        const lives = Math.max(0, player.lives - 1)
        return {
          ...player,
          lives,
          status: lives === 0 ? 'out' : lives === 1 ? 'danger' : player.status,
        }
      }),
    )
  }

  const awardPoint = (id: string) => {
    setPlayers((current) =>
      current.map((player) =>
        player.id === id ? { ...player, score: player.score + 1 } : player,
      ),
    )
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
    setPlayers(initialPlayers)
    setRound(1)
    setQuestionIndex(0)
    resetRound()
  }

  const startCamera = async (playerId: string) => {
    try {
      setCameraError('')
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { aspectRatio: 16 / 9, facingMode: 'user' },
        })
      }
      setCameraPlayerId(playerId)
    } catch (error) {
      setCameraError(
        error instanceof Error
          ? error.message
          : 'Kamera konnte nicht gestartet werden.',
      )
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraPlayerId(null)
  }

  return (
    <main className="ddf-page">
      <div className="ddf-orb ddf-orb-one" aria-hidden="true" />
      <div className="ddf-orb ddf-orb-two" aria-hidden="true" />

      <header className="ddf-topbar">
        <a href="/">Zurueck</a>
        <div className="ddf-title">
          <span>Der Duemmste fliegt</span>
          <strong>Raus</strong>
        </div>
        <div className="ddf-meta">
          <span>Round {round}</span>
          <b>{formatTime(secondsLeft)}</b>
          <em>Normal Voting</em>
        </div>
      </header>

      <section className="ddf-stage" aria-label="Kandidaten">
        {players.map((player, index) => (
          <article
            className={`ddf-player-card ${player.status}`}
            key={player.id}
          >
            <div className="ddf-video-frame">
              {cameraPlayerId === player.id ? (
                <video
                  autoPlay
                  className="ddf-video"
                  muted
                  playsInline
                  ref={videoRef}
                />
              ) : (
                <div className="ddf-camera-placeholder">
                  <strong>{player.name.slice(0, 1)}</strong>
                  <span>Kamera-Slot {index + 1}</span>
                </div>
              )}
              <div className="ddf-status-dots" aria-label="Status">
                <span />
                <span />
              </div>
              <div className="ddf-lives" aria-label={`${player.lives} Leben`}>
                {Array.from({ length: maxLives }, (_, lifeIndex) => (
                  <span
                    className={lifeIndex < player.lives ? 'active' : ''}
                    key={lifeIndex}
                  >
                    ♥
                  </span>
                ))}
              </div>
              <div className="ddf-nameplate">
                <input
                  aria-label="Name"
                  onChange={(event) =>
                    updatePlayer(player.id, { name: event.target.value })
                  }
                  value={player.name}
                />
              </div>
            </div>

            <div className="ddf-card-actions">
              <button onClick={() => awardPoint(player.id)} type="button">
                + Punkt
              </button>
              <button onClick={() => loseLife(player.id)} type="button">
                Leben -
              </button>
              <button
                onClick={() =>
                  updatePlayer(player.id, {
                    status: player.status === 'out' ? 'safe' : 'out',
                    lives: player.status === 'out' ? 1 : 0,
                  })
                }
                type="button"
              >
                {player.status === 'out' ? 'Zurueck' : 'Raus'}
              </button>
              <button onClick={() => startCamera(player.id)} type="button">
                Cam
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="ddf-question-bar">
        <div className="ddf-question-mark">?</div>
        <div>
          <span>{activeQuestion.category}</span>
          <h1>{activeQuestion.prompt}</h1>
          {answerVisible && <strong>{activeQuestion.answer}</strong>}
        </div>
      </section>

      <aside className="ddf-control-panel" aria-label="Spielleitung">
        <div>
          <span>Im Spiel</span>
          <strong>{activePlayers.length}</strong>
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
        <button onClick={() => setAnswerVisible((visible) => !visible)} type="button">
          {answerVisible ? 'Antwort ausblenden' : 'Antwort zeigen'}
        </button>
        <button onClick={nextQuestion} type="button">
          Naechste Frage
        </button>
        <button onClick={() => setPlayers((current) => [...current, createPlayer()])} type="button">
          Spieler +
        </button>
        <button onClick={resetGame} type="button">
          Reset
        </button>
        {cameraPlayerId && (
          <button className="danger" onClick={stopCamera} type="button">
            Kamera stoppen
          </button>
        )}
        {cameraError && <p role="alert">{cameraError}</p>}
      </aside>
    </main>
  )
}

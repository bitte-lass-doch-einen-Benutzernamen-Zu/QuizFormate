import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../../auth/authContext'
import { useBuzzer } from '../../../buzzer/useBuzzer'
import {
  loadVoiceQuestions,
  type VoiceQuizQuestion,
} from '../api/voiceQuiz'
import '../styles/voice-quiz.css'

function createHints(question: VoiceQuizQuestion) {
  return [
    `Der Championname beginnt mit ${question.championName[0]}.`,
    `Der Name hat ${question.championName.length} Buchstaben.`,
    `Der Titel lautet „${question.championTitle}“.`,
  ]
}

export default function VoiceQuizPage() {
  const { activeRoom } = useAuth()
  const room = useBuzzer(activeRoom?.roomId)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [questions, setQuestions] = useState<VoiceQuizQuestion[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [revealedHints, setRevealedHints] = useState(0)
  const [solutionVisible, setSolutionVisible] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadVoiceQuestions()
      .then((items) =>
        setQuestions(
          items
            .filter((item) => item.inQuiz)
            .sort(
              (left, right) =>
                (left.quizPosition ?? Number.MAX_SAFE_INTEGER) -
                (right.quizPosition ?? Number.MAX_SAFE_INTEGER),
            ),
        ),
      )
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : 'Das Hörquiz konnte nicht geladen werden.',
        ),
      )
      .finally(() => setLoading(false))
  }, [])

  const activeQuestion = questions[activeIndex]
  const hints = useMemo(
    () => (activeQuestion ? createHints(activeQuestion) : []),
    [activeQuestion],
  )

  const resetRound = () => {
    setRevealedHints(0)
    setSolutionVisible(false)
  }

  const next = () => {
    if (activeIndex >= questions.length - 1) return
    setActiveIndex((current) => current + 1)
    resetRound()
  }

  const restart = () => {
    setActiveIndex(0)
    resetRound()
    if (activeRoom) {
      void room.resetLiveQuizScores()
    }
  }

  const resetScores = () => {
    if (!activeRoom || room.busy) return
    if (!window.confirm('Punkte fuer dieses Live-Quiz zuruecksetzen?')) return
    void room.resetLiveQuizScores()
  }

  if (loading) return <main className="voice-status">Hörquiz wird geladen...</main>
  if (error || !activeQuestion) {
    return (
      <main className="voice-status">
        <span>League Voice Quiz</span>
        <h1>{error || 'Noch keine Clips im Quiz'}</h1>
        <a href="/voicequiz">Zum Voice Studio</a>
      </main>
    )
  }

  const finished = activeIndex === questions.length - 1 && solutionVisible

  return (
    <main className="voice-play-page">
      <div className="voice-grid-bg" aria-hidden="true" />
      <header className="voice-play-header">
        <a href="/voicequiz">← Voice Studio</a>
        <strong>{activeIndex + 1} / {questions.length}</strong>
      </header>

      <section className="voice-play-stage">
        <div className="voice-audio-stage">
          <span>League Voice Quiz</span>
          <h1>Wer spricht hier?</h1>
          <button
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.currentTime = 0
                void audioRef.current.play()
              }
            }}
            type="button"
          >
            <b>▶</b>
            Voiceline abspielen
          </button>
          <audio
            key={activeQuestion.id}
            ref={audioRef}
            src={activeQuestion.audioUrl}
          />
          <small>Du kannst den Clip beliebig oft neu starten.</small>
        </div>

        <aside className="voice-play-controls">
          <div>
            <span>Spielleitung</span>
            <h2>Runde {activeIndex + 1}</h2>
          </div>

          <ol className="voice-hints">
            {hints.slice(0, revealedHints).map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ol>
          <button
            disabled={revealedHints >= hints.length || solutionVisible}
            onClick={() => setRevealedHints((current) => current + 1)}
            type="button"
          >
            {revealedHints < hints.length
              ? `Hinweis ${revealedHints + 1} zeigen`
              : 'Alle Hinweise gezeigt'}
          </button>
          <button
            className="voice-solution-button"
            onClick={() => setSolutionVisible(true)}
            type="button"
          >
            Auflösung zeigen
          </button>

          {solutionVisible && (
            <div className="voice-solution">
              <span>Gesucht war</span>
              <strong>{activeQuestion.championName}</strong>
              <small>{activeQuestion.championTitle}</small>
            </div>
          )}

          <section className="voice-score-panel">
            <div>
              <span>Punkte vergeben</span>
              <small>Richtig +1 · falsch -1</small>
            </div>
            {activeRoom && (
              <button
                className="score-reset-button"
                disabled={room.busy}
                onClick={resetScores}
                type="button"
              >
                Punkte resetten
              </button>
            )}
            {!activeRoom ? (
              <p>Erstelle zuerst über „Einladung“ einen Spieleabend.</p>
            ) : room.state?.participants.length ? (
              <ol>
                {room.state.participants.map((participant) => (
                  <li key={participant.userId}>
                    <div>
                      <strong>{participant.displayName}</strong>
                      <span>{participant.points} Punkte</span>
                    </div>
                    <div>
                      <button
                        disabled={room.busy}
                        onClick={() =>
                          room.awardMorphPoints(participant.userId, 1)
                        }
                        type="button"
                      >
                        +1
                      </button>
                      <button
                        disabled={room.busy}
                        onClick={() =>
                          room.awardMorphPoints(participant.userId, -1)
                        }
                        type="button"
                      >
                        -1
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p>Noch keine Teilnehmer im Raum.</p>
            )}
          </section>

          {finished ? (
            <button className="voice-next-button" onClick={restart} type="button">
              Quiz neu starten
            </button>
          ) : (
            <button
              className="voice-next-button"
              disabled={!solutionVisible}
              onClick={next}
              type="button"
            >
              Weiter
            </button>
          )}
        </aside>
      </section>
    </main>
  )
}

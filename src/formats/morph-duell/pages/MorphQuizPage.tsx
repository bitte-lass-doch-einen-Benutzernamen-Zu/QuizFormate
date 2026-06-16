import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../auth/authContext'
import LiveQuizWinnerDialog from '../../../buzzer/LiveQuizWinnerDialog'
import { useBuzzer } from '../../../buzzer/useBuzzer'
import {
  loadSavedMorphs,
  type SavedMorph,
} from '../api/generateMorph'
import '../styles/morph-quiz.css'

function createHints(morph: SavedMorph) {
  const first = morph.firstChampion.name
  const second = morph.secondChampion.name
  return [
    `Die Namen beginnen mit ${first[0]} und ${second[0]}.`,
    `Die gesuchten Namen haben ${first.length} und ${second.length} Buchstaben.`,
    `Einer der Champions heißt ${first}.`,
  ]
}

export default function MorphQuizPage() {
  const { activeRoom } = useAuth()
  const room = useBuzzer(activeRoom?.roomId)
  const [morphs, setMorphs] = useState<SavedMorph[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [revealedHints, setRevealedHints] = useState(0)
  const [solutionVisible, setSolutionVisible] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [winnerVisible, setWinnerVisible] = useState(false)

  useEffect(() => {
    loadSavedMorphs()
      .then((items) => {
        setMorphs(
          items
            .filter((item) => item.inQuiz)
            .sort(
              (left, right) =>
                (left.quizPosition ?? Number.MAX_SAFE_INTEGER) -
                (right.quizPosition ?? Number.MAX_SAFE_INTEGER),
            ),
        )
      })
      .catch((reason) => {
        setError(
          reason instanceof Error
            ? reason.message
            : 'Das Morph-Quiz konnte nicht geladen werden.',
        )
      })
      .finally(() => setLoading(false))
  }, [])

  const activeMorph = morphs[activeIndex]
  const hints = useMemo(
    () => (activeMorph ? createHints(activeMorph) : []),
    [activeMorph],
  )

  const resetRoundControls = () => {
    setRevealedHints(0)
    setSolutionVisible(false)
    if (room.state?.morphGuessMode === 'one') {
      void room.setMorphGuessMode('both')
    }
  }

  const showNext = () => {
    if (activeIndex >= morphs.length - 1) return
    setActiveIndex((current) => current + 1)
    resetRoundControls()
  }

  const restart = () => {
    setActiveIndex(0)
    resetRoundControls()
    setWinnerVisible(false)
    if (activeRoom) {
      void room.resetLiveQuizScores()
    }
  }

  const finishQuiz = () => {
    if (!activeRoom || !room.state?.participants.length) return
    if (!window.confirm('Quiz beenden und Gewinner anzeigen?')) return
    setWinnerVisible(true)
  }

  const resetScores = () => {
    if (!activeRoom || room.busy) return
    if (!window.confirm('Punkte fuer dieses Live-Quiz zuruecksetzen?')) return
    void room.resetLiveQuizScores()
  }

  if (loading) {
    return <main className="morph-quiz-status">Morph-Quiz wird geladen...</main>
  }

  if (error || !activeMorph) {
    return (
      <main className="morph-quiz-status">
        <span>Morphduell</span>
        <h1>{error || 'Noch keine Quizkarten gespeichert'}</h1>
        <p>Wähle im Champion Studio mindestens eine Karte für das Quiz aus.</p>
        <a href="/morphduell">Zum Champion Studio</a>
      </main>
    )
  }

  const finished = activeIndex === morphs.length - 1 && solutionVisible

  return (
    <main className="morph-quiz-page">
      <div className="morph-quiz-grid-bg" aria-hidden="true" />
      <header className="morph-quiz-header">
        <a href="/morphduell">← Studio</a>
        <div>
          <span>Runde {activeIndex + 1}</span>
          <strong>{activeIndex + 1} / {morphs.length}</strong>
        </div>
      </header>

      <section className="morph-quiz-stage">
        <div className="morph-quiz-visual">
          <img
            alt="KI-generierter Champion-Morph"
            src={activeMorph.imageUrl}
          />
          <div className="morph-quiz-prompt">
            <span>Morphduell</span>
            <h1>Welche zwei Champions sind das?</h1>
          </div>
          {room.state?.morphGuessMode === 'one' && (
            <div className="morph-one-overlay">
              <strong>Nur 1!</strong>
              <span>Ein Champion reicht jetzt für 1 Punkt.</span>
            </div>
          )}
        </div>

        <aside className="morph-quiz-controls">
          <div>
            <span>
              Schwierigkeit {activeMorph.difficulty === 'easy'
                ? 'Leicht'
                : activeMorph.difficulty === 'hard'
                  ? 'Schwer'
                  : 'Mittel'}
            </span>
            <h2>Spielleitung</h2>
          </div>

          <div className="morph-guess-mode">
            <button
              className={room.state?.morphGuessMode !== 'one' ? 'active' : ''}
              disabled={!activeRoom || room.busy}
              onClick={() => room.setMorphGuessMode('both')}
              type="button"
            >
              Beide · 3 Punkte
            </button>
            <button
              className={room.state?.morphGuessMode === 'one' ? 'active' : ''}
              disabled={!activeRoom || room.busy}
              onClick={() => room.setMorphGuessMode('one')}
              type="button"
            >
              Nur 1 · 1 Punkt
            </button>
          </div>

          <ol className="morph-quiz-hints">
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
            className="solution-button"
            onClick={() => setSolutionVisible(true)}
            type="button"
          >
            Auflösung zeigen
          </button>

          {solutionVisible && (
            <div className="morph-quiz-solution">
              <span>Gesucht waren</span>
              <strong>{activeMorph.firstChampion.name}</strong>
              <i>+</i>
              <strong>{activeMorph.secondChampion.name}</strong>
            </div>
          )}

          <section className="morph-score-panel">
            <div>
              <span>Punkte vergeben</span>
              <small>Beide richtig +3 · einer richtig +1 · falsch -1</small>
            </div>
            {activeRoom && (
              <div className="live-score-actions">
                <button
                  className="score-finish-button"
                  disabled={room.busy || !room.state?.participants.length}
                  onClick={finishQuiz}
                  type="button"
                >
                  Quiz beenden
                </button>
                <button
                  className="score-reset-button"
                  disabled={room.busy}
                  onClick={resetScores}
                  type="button"
                >
                  Punkte resetten
                </button>
              </div>
            )}
            {!activeRoom ? (
              <p>Erstelle zuerst über „Einladung“ einen aktiven Spieleabend.</p>
            ) : room.loading ? (
              <p>Teilnehmer werden geladen...</p>
            ) : room.state?.participants.length ? (
              <ol>
                {room.state.participants.map((participant) => {
                  const answer = room.state?.textEntries.find(
                    (entry) => entry.userId === participant.userId,
                  )
                  return (
                    <li key={participant.userId}>
                      <div>
                        <strong>{participant.displayName}</strong>
                        <span>{participant.points} Punkte</span>
                        {answer && <small>„{answer.content}“</small>}
                      </div>
                      <div>
                        <button
                          disabled={room.busy}
                          onClick={() =>
                            room.awardMorphPoints(participant.userId, 3)
                          }
                          type="button"
                        >
                          +3
                        </button>
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
                  )
                })}
              </ol>
            ) : (
              <p>Noch keine Teilnehmer im aktiven Raum.</p>
            )}
          </section>

          {finished ? (
            <button className="next-button" onClick={restart} type="button">
              Quiz neu starten
            </button>
          ) : (
            <button
              className="next-button"
              disabled={!solutionVisible}
              onClick={showNext}
              type="button"
            >
              Weiter zur nächsten Karte
            </button>
          )}
        </aside>
      </section>
      {winnerVisible && room.state && (
        <LiveQuizWinnerDialog
          participants={room.state.participants}
          onClose={() => setWinnerVisible(false)}
          onRestart={restart}
        />
      )}
    </main>
  )
}

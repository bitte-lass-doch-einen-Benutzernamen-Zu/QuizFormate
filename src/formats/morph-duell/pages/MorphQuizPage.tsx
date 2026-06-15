import { useEffect, useMemo, useState } from 'react'
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
  const [morphs, setMorphs] = useState<SavedMorph[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [revealedHints, setRevealedHints] = useState(0)
  const [solutionVisible, setSolutionVisible] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  const showNext = () => {
    if (activeIndex >= morphs.length - 1) return
    setActiveIndex((current) => current + 1)
    setRevealedHints(0)
    setSolutionVisible(false)
  }

  const restart = () => {
    setActiveIndex(0)
    setRevealedHints(0)
    setSolutionVisible(false)
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
          <div>
            <span>Morphduell</span>
            <h1>Welche zwei Champions sind das?</h1>
          </div>
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
    </main>
  )
}

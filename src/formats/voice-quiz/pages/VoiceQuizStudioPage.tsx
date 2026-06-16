import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import {
  loadLeagueChampions,
  type LeagueChampion,
} from '../../morph-duell/data/leagueChampions'
import {
  addCommunityDragonVoice,
  deleteVoiceQuestion,
  getCommunityDragonVoiceUrl,
  loadVoiceQuestions,
  saveVoiceQuiz,
  uploadVoiceQuestion,
  type VoiceQuizQuestion,
} from '../api/voiceQuiz'
import '../styles/voice-quiz.css'

export default function VoiceQuizStudioPage() {
  const [champions, setChampions] = useState<LeagueChampion[]>([])
  const [questions, setQuestions] = useState<VoiceQuizQuestion[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [dirty, setDirty] = useState(false)

  const refreshQuestions = async () => {
    setQuestions(await loadVoiceQuestions())
  }

  useEffect(() => {
    Promise.all([loadLeagueChampions(), loadVoiceQuestions()])
      .then(([championResult, savedQuestions]) => {
        setChampions(championResult.champions)
        setQuestions(savedQuestions)
        setSelectedId(championResult.champions[0]?.id ?? '')
      })
      .catch((reason) => {
        setMessage(
          reason instanceof Error
            ? reason.message
            : 'Das Voice Studio konnte nicht geladen werden.',
        )
      })
      .finally(() => setLoading(false))
  }, [])

  const selectedChampion = champions.find(
    (champion) => champion.id === selectedId,
  )
  const filteredChampions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('de')
    if (!normalized) return champions
    return champions.filter((champion) =>
      `${champion.name} ${champion.title}`
        .toLocaleLowerCase('de')
        .includes(normalized),
    )
  }, [champions, query])
  const quizQuestions = useMemo(
    () =>
      questions
        .filter((question) => question.inQuiz)
        .sort(
          (left, right) =>
            (left.quizPosition ?? Number.MAX_SAFE_INTEGER) -
            (right.quizPosition ?? Number.MAX_SAFE_INTEGER),
        ),
    [questions],
  )

  const run = async (action: () => Promise<void>, success: string) => {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      await action()
      await refreshQuestions()
      setDirty(false)
      setMessage(success)
    } catch (reason) {
      setMessage(
        reason instanceof Error
          ? reason.message
          : 'Die Aktion ist fehlgeschlagen.',
      )
    } finally {
      setBusy(false)
    }
  }

  const addAutomaticClip = () => {
    if (!selectedChampion) return
    void run(
      () => addCommunityDragonVoice(selectedChampion),
      `${selectedChampion.name} wurde zur Audiobibliothek hinzugefügt.`,
    )
  }

  const uploadClip = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !selectedChampion) return
    void run(
      () => uploadVoiceQuestion(selectedChampion, file),
      `Eigener Clip für ${selectedChampion.name} wurde hochgeladen.`,
    )
  }

  const toggleQuestion = (questionId: string) => {
    setQuestions((current) => {
      const selectedCount = current.filter((question) => question.inQuiz).length
      return current.map((question) =>
        question.id === questionId
          ? {
              ...question,
              inQuiz: !question.inQuiz,
              quizPosition: question.inQuiz ? null : selectedCount,
            }
          : question,
      )
    })
    setDirty(true)
    setMessage('')
  }

  const moveQuestion = (questionId: string, direction: -1 | 1) => {
    const currentIndex = quizQuestions.findIndex(
      (question) => question.id === questionId,
    )
    const targetIndex = currentIndex + direction
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= quizQuestions.length) {
      return
    }
    const reordered = [...quizQuestions]
    ;[reordered[currentIndex], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[currentIndex],
    ]
    const positions = new Map(
      reordered.map((question, index) => [question.id, index]),
    )
    setQuestions((current) =>
      current.map((question) => ({
        ...question,
        quizPosition: positions.get(question.id) ?? question.quizPosition,
      })),
    )
    setDirty(true)
  }

  const removeQuestion = (question: VoiceQuizQuestion) => {
    if (
      !window.confirm(
        `Audioclip fuer ${question.championName} wirklich loeschen?`,
      )
    ) {
      return
    }
    void run(
      () => deleteVoiceQuestion(question),
      `${question.championName}-Clip wurde geloescht.`,
    )
  }

  if (loading) {
    return <main className="voice-status">Voice Studio wird geladen...</main>
  }

  return (
    <main className="voice-studio-page">
      <div className="voice-grid-bg" aria-hidden="true" />
      <a className="voice-back" href="/">← Alle Formate</a>

      <header className="voice-studio-header">
        <div>
          <span>League Voice Quiz</span>
          <h1>Voice Studio</h1>
          <p>
            Übernimm Champion-Auswahl-Ansagen von CommunityDragon oder lade
            eigene Voiceline-Clips hoch. Danach stellst du die Quizreihenfolge
            zusammen.
          </p>
        </div>
        <a
          aria-disabled={dirty || quizQuestions.length === 0}
          className={dirty || quizQuestions.length === 0 ? 'disabled' : ''}
          href={dirty || quizQuestions.length === 0 ? undefined : '/voicequiz/play'}
        >
          Quiz starten
        </a>
      </header>

      <section className="voice-source-panel">
        <div className="voice-champion-picker">
          <label>
            <span>Champion suchen</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name oder Titel..."
              type="search"
              value={query}
            />
          </label>
          <div>
            {filteredChampions.map((champion) => (
              <button
                className={champion.id === selectedId ? 'selected' : ''}
                key={champion.id}
                onClick={() => setSelectedId(champion.id)}
                type="button"
              >
                <img alt="" loading="lazy" src={champion.square} />
                <span>
                  <strong>{champion.name}</strong>
                  <small>{champion.title}</small>
                </span>
              </button>
            ))}
          </div>
        </div>

        {selectedChampion && (
          <article className="voice-selected-champion">
            <img alt="" src={selectedChampion.splash} />
            <div className="voice-selected-copy">
              <span>Ausgewählter Champion</span>
              <h2>{selectedChampion.name}</h2>
              <p>{selectedChampion.title}</p>
              <audio
                controls
                key={selectedChampion.key}
                preload="none"
                src={getCommunityDragonVoiceUrl(selectedChampion.key)}
              />
              <button disabled={busy} onClick={addAutomaticClip} type="button">
                Auswahl-Ansage übernehmen
              </button>
              <label className="voice-upload">
                Eigenen Clip hochladen
                <input
                  accept="audio/mpeg,audio/ogg,audio/wav,audio/mp4"
                  disabled={busy}
                  onChange={uploadClip}
                  type="file"
                />
              </label>
              <small>
                Der automatische Clip stammt aus CommunityDragon und nicht aus
                einer offiziellen Riot-Voiceline-API.
              </small>
            </div>
          </article>
        )}
      </section>

      <section className="voice-library">
        <div className="voice-library-head">
          <div>
            <span>Gespeicherte Clips</span>
            <h2>Dein Hörquiz</h2>
          </div>
          <div>
            <strong>{quizQuestions.length} ausgewählt</strong>
            {dirty && <small>Ungespeicherte Auswahl</small>}
            <button
              disabled={busy}
              onClick={() =>
                run(() => saveVoiceQuiz(questions), 'Hörquiz gespeichert.')
              }
              type="button"
            >
              Quiz speichern
            </button>
          </div>
        </div>

        {message && <p className="voice-message">{message}</p>}
        {questions.length === 0 ? (
          <div className="voice-empty">
            Füge oben deinen ersten Champion-Clip hinzu.
          </div>
        ) : (
          <div className="voice-card-grid">
            {questions.map((question) => {
              const quizIndex = quizQuestions.findIndex(
                (item) => item.id === question.id,
              )
              const champion = champions.find(
                (item) => item.id === question.championId,
              )
              return (
                <article
                  className={question.inQuiz ? 'selected' : ''}
                  key={question.id}
                >
                  <div>
                    {champion && <img alt="" src={champion.square} />}
                    <span>
                      <small>
                        {question.sourceType === 'upload'
                          ? 'Eigener Clip'
                          : 'Champion-Auswahl'}
                      </small>
                      <strong>{question.championName}</strong>
                    </span>
                    {question.inQuiz && <b>{quizIndex + 1}</b>}
                  </div>
                  <audio controls preload="none" src={question.audioUrl} />
                  <footer>
                    <button
                      onClick={() => toggleQuestion(question.id)}
                      type="button"
                    >
                      {question.inQuiz ? 'Entfernen' : 'Zum Quiz'}
                    </button>
                    {question.inQuiz && (
                      <>
                        <button
                          disabled={quizIndex === 0}
                          onClick={() => moveQuestion(question.id, -1)}
                          type="button"
                        >
                          ↑
                        </button>
                        <button
                          disabled={quizIndex === quizQuestions.length - 1}
                          onClick={() => moveQuestion(question.id, 1)}
                          type="button"
                        >
                          ↓
                        </button>
                      </>
                    )}
                    <button
                      className="danger"
                      disabled={busy}
                      onClick={() => removeQuestion(question)}
                      type="button"
                    >
                      Loeschen
                    </button>
                  </footer>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}

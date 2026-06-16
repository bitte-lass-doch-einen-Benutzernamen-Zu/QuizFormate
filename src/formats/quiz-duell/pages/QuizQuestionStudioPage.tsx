import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  loadTriviaQuestions,
  triviaCategories,
  type TriviaCandidate,
} from '../api/triviaApi'
import {
  clearQuizBoards,
  createQuizSet,
  deleteQuizSet,
  defaultBoards,
  loadQuizBoards,
  loadQuizSets,
  resetQuizBoards,
  saveActiveQuizSetId,
  saveQuizBoards,
  type QuizBoard,
  type QuizSetMeta,
  type QuizQuestion,
} from '../data/questions'
import '../styles/quiz-duell.css'

const difficulties = [
  { value: 'any', label: 'Alle' },
  { value: 'easy', label: 'Leicht' },
  { value: 'medium', label: 'Mittel' },
  { value: 'hard', label: 'Schwer' },
]

const questionBatchSize = 24

const emptyDraft = {
  question: '',
  answer: '',
  image: '',
  audio: '',
}

type Draft = typeof emptyDraft

function cloneBoards(boards: QuizBoard[]) {
  return structuredClone(boards)
}

function createSlotQuestion(
  source: Pick<QuizQuestion, 'question' | 'answer'> &
    Partial<Pick<QuizQuestion, 'image' | 'audio'>>,
  board: QuizBoard,
  categoryIndex: number,
  questionIndex: number,
): QuizQuestion {
  const category = board.categories[categoryIndex]
  return {
    id: `${board.id}-${category.id.split('-').at(-1) ?? categoryIndex}-${questionIndex + 1}`,
    category: category.title,
    points: category.questions[questionIndex].points,
    question: source.question.trim(),
    answer: source.answer.trim(),
    image: source.image?.trim() || undefined,
    audio: source.audio?.trim() || undefined,
  }
}

function slotLabel(board: QuizBoard, categoryIndex: number, questionIndex: number) {
  const category = board.categories[categoryIndex]
  const question = category.questions[questionIndex]
  return `${board.title} / ${category.title} / ${question.points}`
}

function findNextEmptySlot(boards: QuizBoard[]) {
  for (let boardIndex = 0; boardIndex < boards.length; boardIndex += 1) {
    const board = boards[boardIndex]
    for (
      let categoryIndex = 0;
      categoryIndex < board.categories.length;
      categoryIndex += 1
    ) {
      const category = board.categories[categoryIndex]
      for (
        let questionIndex = 0;
        questionIndex < category.questions.length;
        questionIndex += 1
      ) {
        const question = category.questions[questionIndex]
        if (!question.question.trim() || !question.answer.trim()) {
          return { boardIndex, categoryIndex, questionIndex }
        }
      }
    }
  }
  return null
}

export default function QuizQuestionStudioPage() {
  const [sets, setSets] = useState<QuizSetMeta[]>(loadQuizSets)
  const [openSetId, setOpenSetId] = useState(() => sets[0]?.id ?? '')
  const [boardsBySet, setBoardsBySet] = useState<Record<string, QuizBoard[]>>(
    () =>
      sets[0]
        ? { [sets[0].id]: cloneBoards(loadQuizBoards(sets[0].id)) }
        : {},
  )
  const [categoryId, setCategoryId] = useState('general_knowledge')
  const [difficulty, setDifficulty] = useState('any')
  const [candidatesByCategory, setCandidatesByCategory] = useState<
    Record<string, TriviaCandidate[]>
  >({})
  const [loadedKeys, setLoadedKeys] = useState<string[]>([])
  const [selectedCandidateId, setSelectedCandidateId] = useState('')
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [selectedSlot, setSelectedSlot] = useState('auto')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const boards = boardsBySet[openSetId] ?? []

  const candidates = candidatesByCategory[categoryId] ?? []
  const selectedCandidate = candidates.find(
    (candidate) => candidate.id === selectedCandidateId,
  ) ?? candidates[0]

  const selectedSlotParts = useMemo(
    () => selectedSlot.split(':').map((value) => Number(value)),
    [selectedSlot],
  )
  const activeLoadKey = `${categoryId}:${difficulty}`

  const openSet = (setId: string) => {
    if (openSetId === setId) {
      setOpenSetId('')
      return
    }
    setOpenSetId(setId)
    saveActiveQuizSetId(setId)
    setSelectedSlot('auto')
    setBoardsBySet((current) =>
      current[setId]
        ? current
        : { ...current, [setId]: cloneBoards(loadQuizBoards(setId)) },
    )
  }

  const addSet = () => {
    const nextSet = createQuizSet()
    setSets(loadQuizSets())
    setBoardsBySet((current) => ({
      ...current,
      [nextSet.id]: cloneBoards(loadQuizBoards(nextSet.id)),
    }))
    setOpenSetId(nextSet.id)
    setSelectedSlot('auto')
  }

  const removeSet = (setId: string) => {
    if (sets.length <= 1) return
    const set = sets.find((item) => item.id === setId)
    if (!window.confirm(`${set?.title ?? 'Quiz Set'} wirklich loeschen?`)) {
      return
    }
    const nextSets = deleteQuizSet(setId)
    setSets(nextSets)
    setBoardsBySet((current) => {
      const next = { ...current }
      delete next[setId]
      return next
    })
    const nextOpenSetId =
      openSetId === setId ? nextSets[0]?.id ?? '' : openSetId
    if (nextOpenSetId) {
      setOpenSetId(nextOpenSetId)
      saveActiveQuizSetId(nextOpenSetId)
    }
  }

  const fetchQuestions = useCallback(async (append = false) => {
    if (loading) return
    setLoading(true)
    setMessage('')
    setLoadedKeys((current) =>
      current.includes(activeLoadKey) ? current : [...current, activeLoadKey],
    )
    try {
      const result = await loadTriviaQuestions({
        limit: questionBatchSize,
        categoryId,
        difficulty,
      })
      setCandidatesByCategory((current) => {
        const existing = append ? current[categoryId] ?? [] : []
        const merged = [...existing]
        for (const question of result) {
          if (!merged.some((item) => item.id === question.id)) {
            merged.push(question)
          }
        }
        return { ...current, [categoryId]: merged }
      })
      const categoryName =
        triviaCategories.find((category) => category.id === categoryId)?.name ??
        'die Kategorie'
      setMessage(`${result.length} Fragen fuer ${categoryName} geladen.`)
    } catch (reason) {
      setMessage(
        reason instanceof Error
          ? reason.message
          : 'Fragen konnten nicht geladen werden.',
      )
    } finally {
      setLoading(false)
    }
  }, [activeLoadKey, categoryId, difficulty, loading])

  useEffect(() => {
    if (candidates.length || loading || loadedKeys.includes(activeLoadKey)) {
      return
    }
    const timer = window.setTimeout(() => {
      void fetchQuestions(false)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [activeLoadKey, candidates.length, fetchQuestions, loadedKeys, loading])

  const updateBoards = (nextBoards: QuizBoard[], success: string) => {
    if (!openSetId) return
    setBoardsBySet((current) => ({ ...current, [openSetId]: nextBoards }))
    saveQuizBoards(nextBoards, openSetId)
    setSets(loadQuizSets())
    setMessage(success)
  }

  const placeQuestion = (
    source: Pick<QuizQuestion, 'question' | 'answer'> &
      Partial<Pick<QuizQuestion, 'image' | 'audio'>>,
  ) => {
    const target =
      selectedSlot === 'auto'
        ? findNextEmptySlot(boards)
        : {
            boardIndex: selectedSlotParts[0],
            categoryIndex: selectedSlotParts[1],
            questionIndex: selectedSlotParts[2],
          }
    if (!target) {
      setMessage('Alle Slots sind voll. Waehle einen Zielslot zum Ueberschreiben.')
      return
    }
    const { boardIndex, categoryIndex, questionIndex } = target
    const board = boards[boardIndex]
    if (!board || !source.question.trim() || !source.answer.trim()) return

    const nextBoards = cloneBoards(boards)
    nextBoards[boardIndex].categories[categoryIndex].questions[questionIndex] =
      createSlotQuestion(source, board, categoryIndex, questionIndex)
    updateBoards(nextBoards, `Frage in ${slotLabel(board, categoryIndex, questionIndex)} gespeichert.`)
  }

  const editExistingQuestion = (
    boardIndex: number,
    categoryIndex: number,
    questionIndex: number,
    update: Partial<QuizQuestion>,
  ) => {
    const nextBoards = cloneBoards(boards)
    const question =
      nextBoards[boardIndex].categories[categoryIndex].questions[questionIndex]
    nextBoards[boardIndex].categories[categoryIndex].questions[questionIndex] = {
      ...question,
      ...update,
      category: nextBoards[boardIndex].categories[categoryIndex].title,
    }
    updateBoards(nextBoards, 'Frage aktualisiert.')
  }

  const restoreDefaults = () => {
    if (!window.confirm('Alle selbst geaenderten Quizduell-Fragen zuruecksetzen?')) {
      return
    }
    const nextBoards = cloneBoards(defaultBoards)
    if (!openSetId) return
    setBoardsBySet((current) => ({ ...current, [openSetId]: nextBoards }))
    resetQuizBoards(openSetId)
    setSets(loadQuizSets())
    setMessage('Standardfragen wiederhergestellt.')
  }

  const clearSet = () => {
    if (!openSetId) return
    if (!window.confirm('Alle Fragen in diesem Set leeren?')) return
    const nextBoards = cloneBoards(clearQuizBoards(openSetId))
    setBoardsBySet((current) => ({ ...current, [openSetId]: nextBoards }))
    setSets(loadQuizSets())
    setSelectedSlot('auto')
    setMessage('Set geleert.')
  }

  return (
    <main className="question-studio-page">
      <div className="background-grid" aria-hidden="true" />
      <header className="question-studio-header">
        <a href="/quizduell">Zurueck zum Board</a>
        <div>
          <span className="eyebrow">Quizduell</span>
          <h1>Fragen-Studio</h1>
        </div>
        <button onClick={addSet} type="button" aria-label="Quiz Set erstellen">
          + Set
        </button>
      </header>

      <section className="quiz-set-manager">
        <div className="quiz-set-manager-head">
          <div>
            <span>Quiz Sets</span>
            <strong>{sets.length} gespeichert</strong>
          </div>
          <button onClick={restoreDefaults} type="button" disabled={!openSetId}>
            Standards ins offene Set
          </button>
          <button onClick={clearSet} type="button" disabled={!openSetId}>
            Set leeren
          </button>
        </div>
        <div className="quiz-set-list">
          {sets.map((set) => {
            const isOpen = set.id === openSetId
            const loadedQuestionCount = boardsBySet[set.id]?.reduce(
              (sum, board) =>
                sum +
                board.categories.reduce(
                  (categorySum, category) =>
                    categorySum + category.questions.length,
                  0,
                ),
              0,
            )
            return (
              <article className={isOpen ? 'open' : ''} key={set.id}>
                <button onClick={() => openSet(set.id)} type="button">
                  <span>{isOpen ? '▾' : '▸'}</span>
                  <strong>{set.title}</strong>
                  <small>
                    {loadedQuestionCount
                      ? `${loadedQuestionCount} Fragen geladen`
                      : 'Fragen nicht geladen'}
                  </small>
                </button>
                <button
                  aria-label={`${set.title} loeschen`}
                  disabled={sets.length <= 1}
                  onClick={() => removeSet(set.id)}
                  type="button"
                >
                  -
                </button>
              </article>
            )
          })}
        </div>
      </section>

      {!openSetId ? (
        <section className="question-studio-closed">
          Oeffne ein Quiz Set, um Fragen zu laden und zu bearbeiten.
        </section>
      ) : (
      <>
        <section className="question-studio-layout">
        <aside className="question-import-panel">
          <div>
            <span>The Trivia API</span>
            <h2>Fragen importieren</h2>
          </div>
          <div className="trivia-category-picker">
            {triviaCategories.map((category) => (
              <button
                className={category.id === categoryId ? 'selected' : ''}
                disabled={loading}
                key={category.id}
                onClick={() => setCategoryId(category.id)}
                type="button"
              >
                <span>{category.name}</span>
                <small>{candidatesByCategory[category.id]?.length ?? 0}</small>
              </button>
            ))}
          </div>
          <label>
            Schwierigkeit
            <select
              disabled={loading}
              onChange={(event) => {
                setDifficulty(event.target.value)
                setCandidatesByCategory({})
                setLoadedKeys([])
              }}
              value={difficulty}
            >
              {difficulties.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button disabled={loading} onClick={() => fetchQuestions(false)} type="button">
            {loading ? 'Laedt...' : candidates.length ? 'Neu laden' : 'Kategorie laden'}
          </button>
          <div className="manual-question-box">
            <span>Manuell</span>
            <textarea
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  question: event.target.value,
                }))
              }
              placeholder="Frage"
              value={draft.question}
            />
            <textarea
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  answer: event.target.value,
                }))
              }
              placeholder="Antwort"
              value={draft.answer}
            />
            <input
              onChange={(event) =>
                setDraft((current) => ({ ...current, image: event.target.value }))
              }
              placeholder="/images/questions/bild.png"
              value={draft.image}
            />
            <input
              onChange={(event) =>
                setDraft((current) => ({ ...current, audio: event.target.value }))
              }
              placeholder="/images/questions/audio.mp3"
              value={draft.audio}
            />
            <button
              disabled={!draft.question.trim() || !draft.answer.trim()}
              onClick={() => placeQuestion(draft)}
              type="button"
            >
              Manuelle Frage einsetzen
            </button>
          </div>
          {message && <p className="question-studio-message">{message}</p>}
        </aside>

        <section className="question-candidate-panel">
          <div className="slot-picker">
            <label>
              Zielslot
              <select
                onChange={(event) => setSelectedSlot(event.target.value)}
                value={selectedSlot}
              >
                <option value="auto">Naechster leerer Slot</option>
                {boards.map((board, boardIndex) =>
                  board.categories.flatMap((category, categoryIndex) =>
                    category.questions.map((question, questionIndex) => (
                      <option
                        key={`${board.id}-${category.id}-${question.id}`}
                        value={`${boardIndex}:${categoryIndex}:${questionIndex}`}
                      >
                        {slotLabel(board, categoryIndex, questionIndex)}
                      </option>
                    )),
                  ),
                )}
              </select>
            </label>
            <button
              disabled={!selectedCandidate}
              onClick={() => selectedCandidate && placeQuestion(selectedCandidate)}
              type="button"
            >
              Auswahl einsetzen
            </button>
          </div>

          <div className="question-candidate-list">
            {candidates.length === 0 ? (
              <p>Waehle links eine Kategorie und lade die ersten Fragen. Andere Kategorien bleiben ausgeblendet.</p>
            ) : (
              <>
                {candidates.map((candidate) => (
                  <article
                    className={candidate.id === selectedCandidateId ? 'selected' : ''}
                    key={candidate.id}
                  >
                    <button
                      onClick={() => setSelectedCandidateId(candidate.id)}
                      type="button"
                    >
                      <span>{candidate.category} / {candidate.difficulty}</span>
                      <strong>{candidate.question}</strong>
                      <small>{candidate.answer}</small>
                    </button>
                    <button onClick={() => placeQuestion(candidate)} type="button">
                      Einsetzen
                    </button>
                  </article>
                ))}
                <button
                  className="load-more-questions"
                  disabled={loading}
                  onClick={() => fetchQuestions(true)}
                  type="button"
                >
                  {loading ? 'Laedt...' : 'Mehr Fragen laden'}
                </button>
              </>
            )}
          </div>
        </section>
        </section>

        <section className="question-board-editor">
        {boards.map((board, boardIndex) => (
          <article key={board.id}>
            <h2>{board.title}</h2>
            <div>
              {board.categories.map((category, categoryIndex) => (
                <section key={category.id}>
                  <h3 style={{ color: category.color }}>
                    {category.title}
                    <small>
                      {
                        category.questions.filter(
                          (question) =>
                            question.question.trim() &&
                            question.answer.trim(),
                        ).length
                      } / {category.questions.length}
                    </small>
                  </h3>
                  {category.questions.some(
                    (question) =>
                      question.question.trim() && question.answer.trim(),
                  ) ? (
                    category.questions.map((question, questionIndex) =>
                      question.question.trim() && question.answer.trim() ? (
                        <details key={question.id}>
                          <summary>
                            <span>{question.points}</span>
                            {question.question}
                          </summary>
                          <label>
                            Frage
                            <textarea
                              onBlur={(event) =>
                                editExistingQuestion(boardIndex, categoryIndex, questionIndex, {
                                  question: event.target.value,
                                })
                              }
                              defaultValue={question.question}
                            />
                          </label>
                          <label>
                            Antwort
                            <textarea
                              onBlur={(event) =>
                                editExistingQuestion(boardIndex, categoryIndex, questionIndex, {
                                  answer: event.target.value,
                                })
                              }
                              defaultValue={question.answer}
                            />
                          </label>
                        </details>
                      ) : null,
                    )
                  ) : (
                    <p className="empty-category-note">Noch leer</p>
                  )}
                </section>
              ))}
            </div>
          </article>
        ))}
        </section>
      </>
      )}
    </main>
  )
}

import { useEffect, useMemo, useState } from 'react'
import {
  loadOpenTriviaCategories,
  loadOpenTriviaQuestions,
  type OpenTriviaCategory,
  type OpenTriviaQuestion,
} from '../api/openTrivia'
import {
  defaultBoards,
  loadQuizBoards,
  resetQuizBoards,
  saveQuizBoards,
  type QuizBoard,
  type QuizQuestion,
} from '../data/questions'
import '../styles/quiz-duell.css'

const difficulties = [
  { value: 'any', label: 'Alle' },
  { value: 'easy', label: 'Leicht' },
  { value: 'medium', label: 'Mittel' },
  { value: 'hard', label: 'Schwer' },
]

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

export default function QuizQuestionStudioPage() {
  const [boards, setBoards] = useState(() => cloneBoards(loadQuizBoards()))
  const [categories, setCategories] = useState<OpenTriviaCategory[]>([])
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [difficulty, setDifficulty] = useState('any')
  const [amount, setAmount] = useState(12)
  const [candidates, setCandidates] = useState<OpenTriviaQuestion[]>([])
  const [selectedCandidateId, setSelectedCandidateId] = useState('')
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [selectedSlot, setSelectedSlot] = useState('0:0:0')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedCandidate = candidates.find(
    (candidate) => candidate.id === selectedCandidateId,
  )

  const selectedSlotParts = useMemo(
    () => selectedSlot.split(':').map((value) => Number(value)),
    [selectedSlot],
  )

  useEffect(() => {
    loadOpenTriviaCategories()
      .then((items) => {
        setCategories(items)
        setCategoryId(items[0]?.id ?? null)
      })
      .catch((reason) =>
        setMessage(
          reason instanceof Error
            ? reason.message
            : 'Kategorien konnten nicht geladen werden.',
        ),
      )
  }, [])

  const fetchQuestions = async () => {
    if (!categoryId || loading) return
    setLoading(true)
    setMessage('')
    try {
      const result = await loadOpenTriviaQuestions({
        amount,
        categoryId,
        difficulty,
      })
      setCandidates(result)
      setSelectedCandidateId(result[0]?.id ?? '')
      setMessage(`${result.length} Fragen geladen.`)
    } catch (reason) {
      setMessage(
        reason instanceof Error
          ? reason.message
          : 'Fragen konnten nicht geladen werden.',
      )
    } finally {
      setLoading(false)
    }
  }

  const updateBoards = (nextBoards: QuizBoard[], success: string) => {
    setBoards(nextBoards)
    saveQuizBoards(nextBoards)
    setMessage(success)
  }

  const placeQuestion = (
    source: Pick<QuizQuestion, 'question' | 'answer'> &
      Partial<Pick<QuizQuestion, 'image' | 'audio'>>,
  ) => {
    const [boardIndex, categoryIndex, questionIndex] = selectedSlotParts
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
    setBoards(nextBoards)
    resetQuizBoards()
    setMessage('Standardfragen wiederhergestellt.')
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
        <button onClick={restoreDefaults} type="button">
          Standards laden
        </button>
      </header>

      <section className="question-studio-layout">
        <aside className="question-import-panel">
          <div>
            <span>Open Trivia DB</span>
            <h2>Fragen importieren</h2>
          </div>
          <label>
            Kategorie
            <select
              disabled={!categories.length || loading}
              onChange={(event) => setCategoryId(Number(event.target.value))}
              value={categoryId ?? ''}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Schwierigkeit
            <select
              disabled={loading}
              onChange={(event) => setDifficulty(event.target.value)}
              value={difficulty}
            >
              {difficulties.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Anzahl
            <input
              max={30}
              min={1}
              onChange={(event) => setAmount(Number(event.target.value))}
              type="number"
              value={amount}
            />
          </label>
          <button disabled={!categoryId || loading} onClick={fetchQuestions} type="button">
            {loading ? 'Laedt...' : 'Fragen laden'}
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
              <p>Lade links eine Kategorie oder erstelle direkt eine manuelle Frage.</p>
            ) : (
              candidates.map((candidate) => (
                <button
                  className={candidate.id === selectedCandidateId ? 'selected' : ''}
                  key={candidate.id}
                  onClick={() => setSelectedCandidateId(candidate.id)}
                  type="button"
                >
                  <span>{candidate.category} / {candidate.difficulty}</span>
                  <strong>{candidate.question}</strong>
                  <small>{candidate.answer}</small>
                </button>
              ))
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
                  <h3 style={{ color: category.color }}>{category.title}</h3>
                  {category.questions.map((question, questionIndex) => (
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
                  ))}
                </section>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}

export type OpenTriviaCategory = {
  id: number
  name: string
}

export type OpenTriviaQuestion = {
  id: string
  category: string
  difficulty: string
  question: string
  answer: string
}

type CategoryResponse = {
  trivia_categories: OpenTriviaCategory[]
}

type QuestionResponse = {
  response_code: number
  results: Array<{
    category: string
    difficulty: string
    question: string
    correct_answer: string
  }>
}

const API_ROOT = 'https://opentdb.com'

function decodeTriviaText(value: string) {
  return decodeURIComponent(value).replace(/&quot;/g, '"').replace(/&#039;/g, "'")
}

export async function loadOpenTriviaCategories() {
  const response = await fetch(`${API_ROOT}/api_category.php`)
  if (!response.ok) throw new Error('Kategorien konnten nicht geladen werden.')
  const payload = (await response.json()) as CategoryResponse
  return payload.trivia_categories
}

export async function loadOpenTriviaQuestions(options: {
  amount: number
  categoryId: number
  difficulty: string
}) {
  const params = new URLSearchParams({
    amount: String(options.amount),
    category: String(options.categoryId),
    type: 'multiple',
    encode: 'url3986',
  })
  if (options.difficulty !== 'any') {
    params.set('difficulty', options.difficulty)
  }

  const response = await fetch(`${API_ROOT}/api.php?${params.toString()}`)
  if (!response.ok) throw new Error('Fragen konnten nicht geladen werden.')
  const payload = (await response.json()) as QuestionResponse
  if (payload.response_code === 1) {
    throw new Error('Fuer diese Auswahl gibt es nicht genug Fragen.')
  }
  if (payload.response_code !== 0) {
    throw new Error('Open Trivia DB hat keine gueltige Antwort geliefert.')
  }

  return payload.results.map((question, index): OpenTriviaQuestion => ({
    id: `${Date.now()}-${index}-${question.correct_answer}`,
    category: decodeTriviaText(question.category),
    difficulty: question.difficulty,
    question: decodeTriviaText(question.question),
    answer: decodeTriviaText(question.correct_answer),
  }))
}

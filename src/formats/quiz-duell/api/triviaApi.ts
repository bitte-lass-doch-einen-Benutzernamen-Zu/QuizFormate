export type TriviaCategory = {
  id: string
  name: string
}

export type TriviaCandidate = {
  id: string
  category: string
  difficulty: string
  question: string
  answer: string
}

type TriviaApiQuestion = {
  id: string
  category: string
  difficulty: string
  correctAnswer: string
  question: {
    text: string
  }
}

const API_ROOT = 'https://the-trivia-api.com/v2/questions'
const TRANSLATE_ROOT = 'https://api.mymemory.translated.net/get'

export const triviaCategories: TriviaCategory[] = [
  { id: 'any', name: 'Alle Kategorien' },
  { id: 'general_knowledge', name: 'Allgemeinwissen' },
  { id: 'history', name: 'Geschichte' },
  { id: 'geography', name: 'Geografie' },
  { id: 'science', name: 'Wissenschaft' },
  { id: 'film_and_tv', name: 'Film & TV' },
  { id: 'music', name: 'Musik' },
  { id: 'sport_and_leisure', name: 'Sport & Freizeit' },
  { id: 'society_and_culture', name: 'Gesellschaft & Kultur' },
  { id: 'arts_and_literature', name: 'Kunst & Literatur' },
  { id: 'food_and_drink', name: 'Essen & Trinken' },
]

const categoryLabels = new Map(
  triviaCategories.map((category) => [category.id, category.name]),
)

export async function loadTriviaQuestions(options: {
  categoryId: string
  difficulty: string
  limit: number
}) {
  const params = new URLSearchParams({
    limit: String(options.limit),
  })
  if (options.categoryId !== 'any') {
    params.set('categories', options.categoryId)
  }
  if (options.difficulty !== 'any') {
    params.set('difficulties', options.difficulty)
  }

  const response = await fetch(`${API_ROOT}?${params.toString()}`)
  if (!response.ok) throw new Error('Fragen konnten nicht geladen werden.')
  const payload = (await response.json()) as TriviaApiQuestion[]

  const difficultyOrder = new Map([
    ['easy', 0],
    ['medium', 1],
    ['hard', 2],
  ])
  const candidates = payload
    .filter(
      (question) =>
        options.difficulty === 'any' ||
        question.difficulty === options.difficulty,
    )
    .sort(
      (left, right) =>
        (difficultyOrder.get(left.difficulty) ?? 99) -
        (difficultyOrder.get(right.difficulty) ?? 99),
    )
    .map((question): TriviaCandidate => ({
      id: question.id,
      category: categoryLabels.get(question.category) ?? question.category,
      difficulty: question.difficulty,
      question: question.question.text,
      answer: question.correctAnswer,
    }))

  return translateCandidates(candidates)
}

async function translateText(text: string) {
  if (!text.trim()) return text
  const params = new URLSearchParams({
    q: text.slice(0, 480),
    langpair: 'en|de',
  })
  try {
    const response = await fetch(`${TRANSLATE_ROOT}?${params.toString()}`)
    if (!response.ok) return text
    const payload = (await response.json()) as {
      responseData?: { translatedText?: string }
    }
    return payload.responseData?.translatedText?.trim() || text
  } catch {
    return text
  }
}

async function translateCandidates(candidates: TriviaCandidate[]) {
  const translated: TriviaCandidate[] = []
  for (const candidate of candidates) {
    const [question, answer] = await Promise.all([
      translateText(candidate.question),
      translateText(candidate.answer),
    ])
    translated.push({ ...candidate, question, answer })
  }
  return translated
}

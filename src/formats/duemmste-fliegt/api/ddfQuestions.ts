import { loadTriviaQuestions } from '../../quiz-duell/api/triviaApi'

export type DdfQuestion = {
  id: string
  category: string
  prompt: string
  answer: string
  source: 'fallback' | 'api'
}

export const fallbackDdfQuestions: DdfQuestion[] = [
  {
    id: 'fallback-001',
    category: 'Allgemeinwissen',
    prompt: 'Welcher Planet ist der Sonne am naechsten?',
    answer: 'Merkur',
    source: 'fallback',
  },
  {
    id: 'fallback-002',
    category: 'Psychologie',
    prompt:
      'Wie nennt man es, wenn Geiseln Verstaendnis fuer ihre Entfuehrer entwickeln?',
    answer: 'Stockholm-Syndrom',
    source: 'fallback',
  },
  {
    id: 'fallback-003',
    category: 'Sprache',
    prompt: 'Wie nennt man ein Wort, das vorwaerts und rueckwaerts gleich ist?',
    answer: 'Palindrom',
    source: 'fallback',
  },
  {
    id: 'fallback-004',
    category: 'Internet',
    prompt: 'Wofuer steht die Abkuerzung URL?',
    answer: 'Uniform Resource Locator',
    source: 'fallback',
  },
  {
    id: 'fallback-005',
    category: 'Geografie',
    prompt: 'Wie heisst die Hauptstadt von Kanada?',
    answer: 'Ottawa',
    source: 'fallback',
  },
  {
    id: 'fallback-006',
    category: 'Games',
    prompt: 'Welcher Block explodiert in Minecraft, wenn man ihn aktiviert?',
    answer: 'TNT',
    source: 'fallback',
  },
  {
    id: 'fallback-007',
    category: 'Film & TV',
    prompt: 'Welche Farbe hat das Lichtschwert von Darth Vader?',
    answer: 'Rot',
    source: 'fallback',
  },
  {
    id: 'fallback-008',
    category: 'Musik',
    prompt: 'Wie viele Saiten hat eine klassische Gitarre normalerweise?',
    answer: 'Sechs',
    source: 'fallback',
  },
  {
    id: 'fallback-009',
    category: 'Wissenschaft',
    prompt: 'Welches chemische Symbol hat Wasserstoff?',
    answer: 'H',
    source: 'fallback',
  },
  {
    id: 'fallback-010',
    category: 'Sport',
    prompt: 'Wie viele Spieler stehen pro Team beim Fussball auf dem Feld?',
    answer: 'Elf',
    source: 'fallback',
  },
  {
    id: 'fallback-011',
    category: 'Essen & Trinken',
    prompt: 'Aus welcher Frucht wird traditionell Guacamole gemacht?',
    answer: 'Avocado',
    source: 'fallback',
  },
  {
    id: 'fallback-012',
    category: 'Geschichte',
    prompt: 'In welchem Land standen die Pyramiden von Gizeh?',
    answer: 'Aegypten',
    source: 'fallback',
  },
  {
    id: 'fallback-013',
    category: 'Allgemeinwissen',
    prompt: 'Wie viele Minuten hat eine Stunde?',
    answer: '60',
    source: 'fallback',
  },
  {
    id: 'fallback-014',
    category: 'Geografie',
    prompt: 'Welcher Ozean liegt zwischen Europa und Nordamerika?',
    answer: 'Atlantischer Ozean',
    source: 'fallback',
  },
  {
    id: 'fallback-015',
    category: 'Wissenschaft',
    prompt: 'Wie nennt man Tiere, die sowohl an Land als auch im Wasser leben?',
    answer: 'Amphibien',
    source: 'fallback',
  },
]

export async function loadDdfQuestionBatch(limit = 50) {
  const questions = await loadTriviaQuestions({
    categoryId: 'any',
    difficulty: 'any',
    limit,
  })

  return questions.map(
    (question): DdfQuestion => ({
      id: question.id,
      category: question.category,
      prompt: question.question,
      answer: question.answer,
      source: 'api',
    }),
  )
}

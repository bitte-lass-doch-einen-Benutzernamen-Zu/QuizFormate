import { lazy, type ComponentType } from 'react'

const loadFormats = () => import('../home/FormatsPage')
const loadMorphDuell = () => import('../home/MorphDuellPage')
const loadMorphQuiz = () =>
  import('../formats/morph-duell/pages/MorphQuizPage')
const loadQuizDuell = () =>
  import('../formats/quiz-duell/pages/QuizDuellPage')
const loadQuizQuestionStudio = () =>
  import('../formats/quiz-duell/pages/QuizQuestionStudioPage')
const loadAnswers = () =>
  import('../formats/quiz-duell/pages/AnswersPage')
const loadVoiceQuizStudio = () =>
  import('../formats/voice-quiz/pages/VoiceQuizStudioPage')
const loadVoiceQuiz = () =>
  import('../formats/voice-quiz/pages/VoiceQuizPage')

const routeComponents: Record<string, ComponentType> = {
  '/': lazy(loadFormats),
  '/quizduell': lazy(loadQuizDuell),
  '/quizduell/studio': lazy(loadQuizQuestionStudio),
  '/morphduell': lazy(loadMorphDuell),
  '/morphduell/quiz': lazy(loadMorphQuiz),
  '/answers': lazy(loadAnswers),
  '/voicequiz': lazy(loadVoiceQuizStudio),
  '/voicequiz/play': lazy(loadVoiceQuiz),
}

export function preloadAdminRoute(pathname: string) {
  if (pathname === '/answers') return loadAnswers()
  if (pathname === '/quizduell') return loadQuizDuell()
  if (pathname === '/quizduell/studio') return loadQuizQuestionStudio()
  if (pathname === '/morphduell') return loadMorphDuell()
  if (pathname === '/morphduell/quiz') return loadMorphQuiz()
  if (pathname === '/voicequiz') return loadVoiceQuizStudio()
  if (pathname === '/voicequiz/play') return loadVoiceQuiz()
  return loadFormats()
}

export function resolveRoute(pathname: string) {
  const Route = routeComponents[pathname] ?? routeComponents['/']
  return <Route />
}

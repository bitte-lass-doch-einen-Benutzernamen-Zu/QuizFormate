import { lazy, type ComponentType } from 'react'

const loadFormats = () => import('../home/FormatsPage')
const loadMorphDuell = () => import('../home/MorphDuellPage')
const loadQuizDuell = () =>
  import('../formats/quiz-duell/pages/QuizDuellPage')
const loadAnswers = () =>
  import('../formats/quiz-duell/pages/AnswersPage')

const routeComponents: Record<string, ComponentType> = {
  '/': lazy(loadFormats),
  '/quizduell': lazy(loadQuizDuell),
  '/morphduell': lazy(loadMorphDuell),
  '/answers': lazy(loadAnswers),
}

export function preloadAdminRoute(pathname: string) {
  if (pathname === '/answers') return loadAnswers()
  if (pathname === '/quizduell') return loadQuizDuell()
  if (pathname === '/morphduell') return loadMorphDuell()
  return loadFormats()
}

export function resolveRoute(pathname: string) {
  const Route = routeComponents[pathname] ?? routeComponents['/']
  return <Route />
}

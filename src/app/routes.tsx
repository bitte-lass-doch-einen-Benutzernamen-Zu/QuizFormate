import { lazy, type ComponentType } from 'react'

const loadQuizDuell = () =>
  import('../formats/quiz-duell/pages/QuizDuellPage')
const loadAnswers = () =>
  import('../formats/quiz-duell/pages/AnswersPage')

const routeComponents: Record<string, ComponentType> = {
  '/': lazy(loadQuizDuell),
  '/answers': lazy(loadAnswers),
}

export function preloadAdminRoute(pathname: string) {
  return pathname === '/answers' ? loadAnswers() : loadQuizDuell()
}

export function resolveRoute(pathname: string) {
  const Route = routeComponents[pathname] ?? routeComponents['/']
  return <Route />
}

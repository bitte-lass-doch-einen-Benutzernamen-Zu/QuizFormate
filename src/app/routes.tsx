import type { ReactNode } from 'react'
import AnswersPage from '../formats/quiz-duell/pages/AnswersPage'
import QuizDuellPage from '../formats/quiz-duell/pages/QuizDuellPage'

type AppRoute = {
  path: string
  element: ReactNode
}

const routes: AppRoute[] = [
  { path: '/answers', element: <AnswersPage /> },
  { path: '/', element: <QuizDuellPage /> },
]

export function resolveRoute(pathname: string) {
  return routes.find((route) => route.path === pathname)?.element ?? routes[1].element
}

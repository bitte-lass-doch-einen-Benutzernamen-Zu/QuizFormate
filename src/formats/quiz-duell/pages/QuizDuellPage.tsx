import GameHeader from '../components/GameHeader'
import QuestionDialog from '../components/QuestionDialog'
import QuizBoard from '../components/QuizBoard'
import Scoreboard from '../components/Scoreboard'
import TeamManagerDialog from '../components/TeamManagerDialog'
import WinnerDialog from '../components/WinnerDialog'
import { useQuizDuellGame } from '../hooks/useQuizDuellGame'
import '../styles/quiz-duell.css'

function QuizDuellPage() {
  const quiz = useQuizDuellGame()
  const { game, activeTeam, activeQuestion, teamManagerOpen } = quiz

  return (
    <main
      className={`game-shell${
        activeQuestion || teamManagerOpen || game.gameFinished
          ? ' modal-open'
          : ''
      }`}
    >
      <div className="background-grid" aria-hidden="true" />

      {game.feedback && (
        <div
          className={`feedback-flash ${game.feedback.type}`}
          key={game.feedback.timestamp}
          role="status"
        >
          <span>{game.feedback.type === 'correct' ? 'RICHTIG' : 'FALSCH'}</span>
        </div>
      )}

      <GameHeader activeTeam={activeTeam} />
      <QuizBoard quiz={quiz} />
      <Scoreboard quiz={quiz} />

      {game.gameFinished && <WinnerDialog quiz={quiz} />}
      {activeQuestion && <QuestionDialog quiz={quiz} />}
      {teamManagerOpen && <TeamManagerDialog quiz={quiz} />}
    </main>
  )
}

export default QuizDuellPage

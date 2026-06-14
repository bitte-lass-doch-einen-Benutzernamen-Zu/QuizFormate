import type { CSSProperties } from 'react'
import { boards } from '../data/questions'
import type { QuizDuellController } from '../hooks/useQuizDuellGame'
import TimerPanel from './TimerPanel'

type QuizBoardProps = {
  quiz: QuizDuellController
}

export default function QuizBoard({ quiz }: QuizBoardProps) {
  const {
    game,
    updateGame,
    activeBoard,
    playedOnBoard,
    totalQuestions,
    openQuestion,
    restoreQuestion,
  } = quiz

  return (
    <section className="board-section">
      <div className="board-meta">
        <div className="board-tabs">
          {boards.map((board) => (
            <button
              className={board.id === activeBoard.id ? 'active' : ''}
              key={board.id}
              onClick={() =>
                updateGame((current) => ({
                  ...current,
                  activeBoardId: board.id,
                  activeQuestionId: null,
                  answerVisible: false,
                }))
              }
              type="button"
            >
              {board.title}
              <small>{board.subtitle}</small>
            </button>
          ))}
        </div>
        <div className="board-tools">
          <TimerPanel />
          <a href="/answers" target="_blank" rel="noreferrer">
            Lösungen öffnen
          </a>
          <span>{playedOnBoard} / {totalQuestions} gespielt</span>
        </div>
      </div>

      <div className="quiz-board">
        {activeBoard.categories.map((category, categoryIndex) => (
          <article
            className="category-column"
            key={category.id}
            style={{
              '--category-color': category.color,
              '--delay': `${categoryIndex * 60}ms`,
            } as CSSProperties}
          >
            <header className="category-header">
              <span className="category-number">
                {String(categoryIndex + 1).padStart(2, '0')}
              </span>
              <h2>{category.title}</h2>
            </header>

            <div className="question-list">
              {category.questions.map((question) => {
                const isPlayed = game.playedQuestionIds.includes(question.id)
                return (
                  <div
                    className={`point-tile-wrap${isPlayed ? ' played' : ''}`}
                    key={question.id}
                  >
                    <button
                      className="point-tile"
                      disabled={isPlayed}
                      onClick={() => openQuestion(question.id)}
                      type="button"
                    >
                      {isPlayed ? (
                        <>
                          <span className="checkmark">✓</span>
                          <small>gespielt</small>
                        </>
                      ) : (
                        <>
                          <strong>{question.points}</strong>
                          <small>Punkte</small>
                        </>
                      )}
                    </button>
                    {isPlayed && (
                      <button
                        className="restore-question"
                        onClick={() => restoreQuestion(question.id)}
                        title="Frage wieder freigeben"
                        type="button"
                      >
                        ↻
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

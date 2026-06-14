import { allQuestions, boards } from '../data/questions'
import { useGameState } from '../state/gameState'
import '../styles/answers.css'

export default function AnswersPage() {
  const [game] = useGameState()
  const activeQuestion = allQuestions.find(
    (question) => question.id === game.activeQuestionId,
  )

  return (
    <main className="answers-page">
      <header className="answers-header">
        <div>
          <span className="eyebrow">Quiz Duell Regie</span>
          <h1>Lösungen</h1>
        </div>
        <a href="/">Zum Quizboard</a>
      </header>

      <section className="live-answer" aria-live="polite">
        <span>Aktuelle Frage</span>
        {activeQuestion ? (
          <>
            <div className="live-answer-meta">
              {activeQuestion.category} · {activeQuestion.points} Punkte
            </div>
            <h2>{activeQuestion.question}</h2>
            {activeQuestion.image && (
              <img
                className="live-answer-image"
                src={activeQuestion.image}
                alt="Bild zur aktuellen Quizfrage"
              />
            )}
            {activeQuestion.audio && (
              <audio
                className="live-answer-audio"
                controls
                preload="metadata"
                src={activeQuestion.audio}
              />
            )}
            <strong>{activeQuestion.answer}</strong>
          </>
        ) : (
          <p>Auf dem Quizboard wurde aktuell keine Frage geöffnet.</p>
        )}
      </section>

      {boards.map((board) => (
        <section className="answers-board" key={board.id}>
          <div className="answers-board-title">
            <span>{board.subtitle}</span>
            <h2>{board.title}</h2>
          </div>
          <div className="answer-categories">
            {board.categories.map((category) => (
              <section className="answer-category" key={category.id}>
                <h2 style={{ color: category.color }}>{category.title}</h2>
                {category.questions.map((question) => (
                  <article
                    className={`answer-card${
                      question.id === game.activeQuestionId ? ' current' : ''
                    }`}
                    key={question.id}
                  >
                    <div>
                      <span>{question.points}</span>
                      {game.playedQuestionIds.includes(question.id) && <b>Gespielt</b>}
                    </div>
                    {question.image && (
                      <img
                        className="answer-card-image"
                        src={question.image}
                        alt={`Bild für ${question.points} Punkte`}
                      />
                    )}
                    {question.audio && (
                      <audio
                        className="answer-card-audio"
                        controls
                        preload="none"
                        src={question.audio}
                      />
                    )}
                    <p>{question.question}</p>
                    <strong>{question.answer}</strong>
                  </article>
                ))}
              </section>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}

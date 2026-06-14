import type { CSSProperties } from 'react'
import type { QuizDuellController } from '../hooks/useQuizDuellGame'

type QuestionDialogProps = {
  quiz: QuizDuellController
}

export default function QuestionDialog({ quiz }: QuestionDialogProps) {
  const {
    game,
    updateGame,
    activeQuestion,
    closeQuestion,
    finishQuestion,
    startSteal,
    finishSteal,
  } = quiz

  if (!activeQuestion) return null

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-labelledby="question-title"
        aria-modal="true"
        className="question-modal"
        role="dialog"
      >
        <div className="modal-topline">
          <span>{activeQuestion.category}</span>
          <strong>{activeQuestion.points} PTS</strong>
        </div>
        <div className="modal-content">
          <span className="question-label">Die Frage</span>
          <h2 id="question-title">{activeQuestion.question}</h2>
          {activeQuestion.image && (
            <div className="question-image-frame">
              <img alt="Bild zur Quizfrage" src={activeQuestion.image} />
            </div>
          )}
          {activeQuestion.audio && (
            <div className="question-audio-frame">
              <span>Audiofrage</span>
              <audio
                controls
                key={activeQuestion.audio}
                preload="metadata"
                src={activeQuestion.audio}
              >
                Dein Browser unterstützt keine Audiowiedergabe.
              </audio>
            </div>
          )}
          <div className={`answer-box${game.answerVisible ? ' visible' : ''}`}>
            <span>Antwort</span>
            <p>
              {game.answerVisible
                ? activeQuestion.answer
                : 'Klicken, um die Lösung aufzudecken'}
            </p>
            {!game.answerVisible && (
              <button
                onClick={() =>
                  updateGame((current) => ({
                    ...current,
                    answerVisible: true,
                  }))
                }
                type="button"
              >
                Antwort zeigen
              </button>
            )}
          </div>
        </div>

        {game.pendingSteal ? (
          <div className="steal-panel">
            <div>
              <span className="question-label">Frage klauen</span>
              <h3>
                Welches Team bekommt {activeQuestion.points / 2} Punkte?
              </h3>
            </div>
            <div className="steal-teams">
              {game.teams
                .filter(
                  (team) => team.id !== game.pendingSteal?.originalTeamId,
                )
                .map((team) => (
                  <button
                    key={team.id}
                    onClick={() => finishSteal(team.id)}
                    style={{ '--player-color': team.color } as CSSProperties}
                    type="button"
                  >
                    <span style={{ backgroundColor: team.color }} />
                    {team.name}
                    <strong>+{activeQuestion.points / 2}</strong>
                  </button>
                ))}
            </div>
            <button
              className="no-steal-button"
              onClick={() => finishSteal(null)}
              type="button"
            >
              Niemand klaut die Frage
            </button>
          </div>
        ) : (
          <>
            <button className="steal-trigger" onClick={startSteal} type="button">
              <span>⚡</span>
              Falsch – Steal freigeben
              <small>Roter Flash, danach Team auswählen</small>
            </button>
            <div className="modal-actions">
              <button
                className="action-button close"
                onClick={closeQuestion}
                type="button"
              >
                Schließen
              </button>
              <button
                className="action-button wrong"
                onClick={() => finishQuestion(false)}
                type="button"
              >
                <span>×</span> Falsch (−{activeQuestion.points / 2})
              </button>
              <button
                className="action-button correct"
                onClick={() => finishQuestion(true)}
                type="button"
              >
                <span>✓</span> Richtig
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

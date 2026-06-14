import type { CSSProperties } from 'react'
import type { QuizDuellController } from '../hooks/useQuizDuellGame'

type WinnerDialogProps = {
  quiz: QuizDuellController
}

export default function WinnerDialog({ quiz }: WinnerDialogProps) {
  const {
    game,
    updateGame,
    winners,
    highestScore,
    standings,
    resetGame,
  } = quiz

  return (
    <div className="modal-backdrop celebration-backdrop">
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 24 }, (_, index) => (
          <i
            key={index}
            style={
              {
                '--confetti-index': index,
                '--confetti-color':
                  game.teams[index % game.teams.length].color,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <section className="winner-modal" role="dialog" aria-modal="true">
        <span className="winner-kicker">
          {winners.length > 1 ? 'Gleichstand' : 'Gewinner'}
        </span>
        <div className="winner-trophy" aria-hidden="true">★</div>
        <h2>{winners.map((team) => team.name).join(' & ')}</h2>
        <strong>{highestScore} Punkte</strong>
        {winners.some((team) => team.members.length > 0) && (
          <p>{winners.flatMap((team) => team.members).join(' · ')}</p>
        )}

        <div className="final-standings">
          {standings.map((team, index) => (
            <div key={team.id}>
              <span>{index + 1}.</span>
              <i style={{ backgroundColor: team.color }} />
              <b>{team.name}</b>
              <strong>{team.score}</strong>
            </div>
          ))}
        </div>

        <div className="winner-actions">
          <button
            onClick={() =>
              updateGame((current) => ({ ...current, gameFinished: false }))
            }
            type="button"
          >
            Zurück zum Board
          </button>
          <button onClick={resetGame} type="button">
            Neues Spiel
          </button>
        </div>
      </section>
    </div>
  )
}

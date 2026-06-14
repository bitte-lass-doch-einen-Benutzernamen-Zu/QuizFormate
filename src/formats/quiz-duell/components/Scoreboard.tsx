import type { CSSProperties } from 'react'
import type { QuizDuellController } from '../hooks/useQuizDuellGame'

type ScoreboardProps = {
  quiz: QuizDuellController
}

export default function Scoreboard({ quiz }: ScoreboardProps) {
  const {
    game,
    updateGame,
    setTeamManagerOpen,
    adjustScore,
    finishGame,
    resetGame,
  } = quiz

  return (
    <footer className="score-area">
      <div className="score-label">
        <span className="eyebrow">Scoreboard</span>
        <strong>Teams</strong>
        <button onClick={() => setTeamManagerOpen(true)} type="button">
          Verwalten
        </button>
      </div>

      <div
        className="players"
        style={{ '--team-count': game.teams.length } as CSSProperties}
      >
        {game.teams.map((team, index) => (
          <article
            className={`player-card${
              index === game.activeTeamIndex ? ' active' : ''
            }`}
            key={team.id}
            style={{ '--player-color': team.color } as CSSProperties}
          >
            <button
              className="score-adjust"
              onClick={() => adjustScore(team.id, -25)}
              title="25 Punkte abziehen"
              type="button"
            >
              −
            </button>
            <button
              className="player-info"
              onClick={() =>
                updateGame((current) => ({
                  ...current,
                  activeTeamIndex: index,
                }))
              }
              type="button"
            >
              <strong>{team.name}</strong>
              <span>
                {team.members.length
                  ? team.members.join(' · ')
                  : 'Keine Mitglieder'}
              </span>
            </button>
            <b>{team.score}</b>
            <small>PTS</small>
            <button
              className="score-adjust"
              onClick={() => adjustScore(team.id, 25)}
              title="25 Punkte hinzufügen"
              type="button"
            >
              +
            </button>
          </article>
        ))}
      </div>

      <div className="game-actions">
        <button className="finish-game-button" onClick={finishGame} type="button">
          Spiel beenden
        </button>
        <button className="reset-button" onClick={resetGame} type="button">
          ↻ <span>Reset</span>
        </button>
      </div>
    </footer>
  )
}

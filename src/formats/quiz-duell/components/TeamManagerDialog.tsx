import type { QuizDuellController } from '../hooks/useQuizDuellGame'

type TeamManagerDialogProps = {
  quiz: QuizDuellController
}

export default function TeamManagerDialog({ quiz }: TeamManagerDialogProps) {
  const {
    game,
    setTeamManagerOpen,
    memberDrafts,
    setMemberDrafts,
    updateTeamName,
    addMember,
    removeMember,
    addTeam,
    removeTeam,
  } = quiz

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="team-manager" role="dialog" aria-modal="true">
        <div className="manager-header">
          <div>
            <span className="eyebrow">Spiel konfigurieren</span>
            <h2>Teams & Mitglieder</h2>
          </div>
          <button onClick={() => setTeamManagerOpen(false)} type="button">
            ×
          </button>
        </div>

        <div className="team-editor-list">
          {game.teams.map((team, teamIndex) => (
            <article className="team-editor" key={team.id}>
              <div className="team-editor-title">
                <span style={{ background: team.color }} />
                <input
                  aria-label={`Name von Team ${teamIndex + 1}`}
                  onChange={(event) =>
                    updateTeamName(team.id, event.target.value)
                  }
                  value={team.name}
                />
                <button
                  disabled={game.teams.length <= 2}
                  onClick={() => removeTeam(team.id)}
                  type="button"
                >
                  Team entfernen
                </button>
              </div>

              <div className="member-list">
                {team.members.map((member, memberIndex) => (
                  <span key={`${member}-${memberIndex}`}>
                    {member}
                    <button
                      onClick={() => removeMember(team.id, memberIndex)}
                      type="button"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              <form
                className="add-member"
                onSubmit={(event) => {
                  event.preventDefault()
                  addMember(team.id)
                }}
              >
                <input
                  onChange={(event) =>
                    setMemberDrafts((current) => ({
                      ...current,
                      [team.id]: event.target.value,
                    }))
                  }
                  placeholder="Name eines Teilnehmers"
                  value={memberDrafts[team.id] ?? ''}
                />
                <button type="submit">Person hinzufügen</button>
              </form>
            </article>
          ))}
        </div>

        <div className="manager-footer">
          <button
            disabled={game.teams.length >= 6}
            onClick={addTeam}
            type="button"
          >
            + Team hinzufügen ({game.teams.length}/6)
          </button>
          <button onClick={() => setTeamManagerOpen(false)} type="button">
            Fertig
          </button>
        </div>
      </section>
    </div>
  )
}

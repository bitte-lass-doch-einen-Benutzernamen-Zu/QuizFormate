import type { Team } from '../state/gameState'

type GameHeaderProps = {
  activeTeam: Team
}

export default function GameHeader({ activeTeam }: GameHeaderProps) {
  return (
    <header className="game-header">
      <section className="host-card" aria-label="Host Webcam Platzhalter">
        <div className="camera-icon"><span /></div>
        <div>
          <span className="eyebrow">Live Studio</span>
          <strong>Host Cam</strong>
        </div>
        <span className="live-badge">LIVE</span>
      </section>

      <div className="brand">
        <span className="brand-kicker">The Ultimate</span>
        <h1>Quiz <em>Duell</em></h1>
        <span className="brand-line" />
      </div>

      <section className="turn-card" aria-live="polite">
        <span className="eyebrow">Team&apos;s Turn</span>
        <strong>{activeTeam.name}</strong>
        <div className="turn-status">
          <span
            className="turn-dot"
            style={{ backgroundColor: activeTeam.color }}
          />
          {activeTeam.members.length
            ? activeTeam.members.join(', ')
            : 'Noch keine Mitglieder'}
        </div>
      </section>
    </header>
  )
}

import type { RoomParticipant } from './useBuzzer'

type LiveQuizWinnerDialogProps = {
  participants: RoomParticipant[]
  onClose: () => void
  onRestart: () => void
}

export default function LiveQuizWinnerDialog({
  participants,
  onClose,
  onRestart,
}: LiveQuizWinnerDialogProps) {
  const standings = [...participants].sort((left, right) => {
    if (right.points !== left.points) return right.points - left.points
    return left.displayName.localeCompare(right.displayName, 'de')
  })
  const highestScore = standings[0]?.points ?? 0
  const winners = standings.filter(
    (participant) => participant.points === highestScore,
  )

  return (
    <div className="live-winner-backdrop">
      <section className="live-winner-modal" role="dialog" aria-modal="true">
        <span>{winners.length > 1 ? 'Gleichstand' : 'Gewinner'}</span>
        <div aria-hidden="true">★</div>
        <h2>
          {winners.length
            ? winners.map((participant) => participant.displayName).join(' & ')
            : 'Keine Teilnehmer'}
        </h2>
        <strong>{highestScore} Punkte</strong>

        <ol>
          {standings.map((participant, index) => (
            <li key={participant.userId}>
              <span>{index + 1}.</span>
              <b>{participant.displayName}</b>
              <strong>{participant.points}</strong>
            </li>
          ))}
        </ol>

        <footer>
          <button onClick={onClose} type="button">
            Zurueck
          </button>
          <button onClick={onRestart} type="button">
            Neues Quiz
          </button>
        </footer>
      </section>
    </div>
  )
}

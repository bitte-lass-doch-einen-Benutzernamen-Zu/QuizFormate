import { useAuth } from './authContext'
import { useBuzzer } from '../buzzer/useBuzzer'
import '../buzzer/buzzer.css'

export default function ViewerPage() {
  const { guestAccess, session, signOut } = useAuth()
  const buzzer = useBuzzer(guestAccess?.roomId)
  const isWinner =
    Boolean(session?.user.id) &&
    buzzer.state?.winnerUserId === session?.user.id
  const hasWinner = Boolean(buzzer.state?.winnerUserId)
  const canPress = Boolean(buzzer.state?.isOpen && !hasWinner && !buzzer.busy)

  const status = buzzer.loading
    ? 'Verbindung wird hergestellt'
    : buzzer.state?.winnerName
      ? isWinner
        ? 'Du warst zuerst'
        : `${buzzer.state.winnerName} war zuerst`
      : buzzer.state?.isOpen
        ? 'Der Buzzer ist frei'
        : 'Warte auf die Spielleitung'

  return (
    <main className={`buzzer-page${isWinner ? ' winner' : ''}`}>
      <div className="buzzer-grid" aria-hidden="true" />
      <header className="buzzer-viewer-head">
        <div>
          <span className="viewer-status">Live verbunden</span>
          <h1>{guestAccess?.roomTitle ?? 'Spieleabend'}</h1>
        </div>
        <button onClick={signOut} type="button">Abmelden</button>
      </header>

      <section className="buzzer-stage">
        <div className="buzzer-player">
          Du spielst als <strong>{guestAccess?.displayName}</strong>
        </div>
        <p className="buzzer-status" aria-live="polite">{status}</p>

        <button
          className="main-buzzer"
          disabled={!canPress}
          onClick={buzzer.press}
          type="button"
        >
          <span>{isWinner ? 'ERSTER!' : hasWinner ? 'ZU SPÄT' : 'BUZZER'}</span>
          <small>
            {canPress
              ? 'Jetzt drücken'
              : buzzer.state?.isOpen
                ? 'Runde entschieden'
                : 'Noch gesperrt'}
          </small>
        </button>

        {buzzer.error && <p className="buzzer-error">{buzzer.error}</p>}
        <p className="buzzer-hint">
          Der Server entscheidet atomar, wer tatsächlich zuerst war.
        </p>
      </section>
    </main>
  )
}

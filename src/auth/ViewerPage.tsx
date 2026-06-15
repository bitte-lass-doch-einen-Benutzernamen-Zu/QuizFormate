import { useBuzzer } from '../buzzer/useBuzzer'
import { useAuth } from './authContext'
import '../buzzer/buzzer.css'

export default function ViewerPage() {
  const { guestAccess, session, signOut } = useAuth()
  const buzzer = useBuzzer(guestAccess?.roomId)
  const ownEntry = buzzer.state?.queue.find(
    (entry) => entry.userId === session?.user.id,
  )
  const isWinner = ownEntry?.position === 1
  const canPress = Boolean(
    buzzer.state?.isOpen && !ownEntry && !buzzer.busy,
  )

  const status = buzzer.loading
    ? 'Verbindung wird hergestellt'
    : ownEntry
      ? ownEntry.position === 1
        ? 'Du warst zuerst'
        : `Du bist auf Platz ${ownEntry.position}`
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
          <span>
            {ownEntry
              ? ownEntry.position === 1
                ? 'ERSTER!'
                : `PLATZ ${ownEntry.position}`
              : 'BUZZER'}
          </span>
          <small>
            {canPress
              ? 'Jetzt drücken'
              : ownEntry
                ? 'Antwort registriert'
                : 'Noch gesperrt'}
          </small>
        </button>

        {Boolean(buzzer.state?.queue.length) && (
          <div className="viewer-buzzer-queue">
            <span>Aktuelle Reihenfolge</span>
            <ol>
              {buzzer.state?.queue.map((entry) => (
                <li
                  className={entry.userId === session?.user.id ? 'you' : ''}
                  key={entry.userId}
                >
                  <b>{entry.position}</b>
                  <strong>{entry.displayName}</strong>
                  {entry.userId === session?.user.id && <small>Du</small>}
                </li>
              ))}
            </ol>
          </div>
        )}

        {buzzer.error && <p className="buzzer-error">{buzzer.error}</p>}
        <p className="buzzer-hint">
          Der Server vergibt alle Plätze atomar in der echten Reihenfolge.
        </p>
      </section>
    </main>
  )
}

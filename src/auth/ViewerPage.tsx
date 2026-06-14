import { useAuth } from './authContext'
import './auth.css'

export default function ViewerPage() {
  const { guestAccess, signOut } = useAuth()

  return (
    <main className="viewer-page">
      <section className="viewer-card">
        <span className="viewer-status">Verbunden</span>
        <h1>{guestAccess?.roomTitle ?? 'Spieleabend'}</h1>
        <p>
          Angemeldet als <strong>{guestAccess?.displayName}</strong>
        </p>
        <div className="viewer-placeholder">
          Die Teilnehmeransicht ist bereit. Hier erscheinen später Buzzer und
          freigegebene Inhalte des aktiven Formats.
        </div>
        <button onClick={signOut} type="button">Abmelden</button>
      </section>
    </main>
  )
}

import { useState } from 'react'
import { useAuth } from '../auth/authContext'
import { useBuzzer } from './useBuzzer'
import './buzzer.css'

export default function BuzzerAdminPanel() {
  const { activeRoom } = useAuth()
  const buzzer = useBuzzer(activeRoom?.roomId)
  const [open, setOpen] = useState(false)

  return (
    <aside className={`buzzer-admin${open ? ' open' : ''}`}>
      <button
        className="buzzer-admin-toggle"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className={`buzzer-live-dot${buzzer.state?.isOpen ? ' active' : ''}`} />
        Live-Buzzer
      </button>

      {open && (
        <section className="buzzer-console">
          <div className="buzzer-console-head">
            <div>
              <span>Spielleitung</span>
              <h2>Live-Buzzer</h2>
            </div>
            <button onClick={() => setOpen(false)} type="button" aria-label="Schließen">
              ×
            </button>
          </div>

          {!activeRoom ? (
            <div className="buzzer-empty">
              Erstelle zuerst unter <strong>Einladung</strong> einen Spieleabend.
            </div>
          ) : buzzer.loading ? (
            <div className="buzzer-empty">Buzzer wird verbunden...</div>
          ) : buzzer.error && !buzzer.state ? (
            <div className="buzzer-setup-error">
              <strong>Supabase-Einrichtung fehlt</strong>
              <p>{buzzer.error}</p>
            </div>
          ) : (
            <>
              <div className="buzzer-room-label">
                <span>Aktiver Raum</span>
                <strong>{activeRoom.roomTitle}</strong>
              </div>

              <div className="buzzer-queue-head">
                <div>
                  <span>Reihenfolge</span>
                  <strong>
                    {buzzer.state?.isOpen ? 'Runde läuft' : 'Buzzer gesperrt'}
                  </strong>
                </div>
                <b>{buzzer.state?.queue.length ?? 0}</b>
              </div>

              <ol className="buzzer-queue">
                {buzzer.state?.queue.length ? (
                  buzzer.state.queue.map((entry) => (
                    <li key={entry.userId}>
                      <b>{entry.position}</b>
                      <strong>{entry.displayName}</strong>
                      <time>
                        {new Date(entry.buzzedAt).toLocaleTimeString('de-AT', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </time>
                    </li>
                  ))
                ) : (
                  <li className="empty">Noch niemand hat gedrückt.</li>
                )}
              </ol>

              <div className="buzzer-admin-actions">
                <button
                  className="open-buzzer"
                  disabled={buzzer.busy}
                  onClick={buzzer.open}
                  type="button"
                >
                  Freigeben
                </button>
                <button
                  disabled={buzzer.busy || !buzzer.state?.isOpen}
                  onClick={buzzer.lock}
                  type="button"
                >
                  Sperren
                </button>
                <button
                  disabled={buzzer.busy}
                  onClick={buzzer.reset}
                  type="button"
                >
                  Zurücksetzen
                </button>
              </div>
              {buzzer.error && <p className="buzzer-error">{buzzer.error}</p>}
            </>
          )}
        </section>
      )}
    </aside>
  )
}

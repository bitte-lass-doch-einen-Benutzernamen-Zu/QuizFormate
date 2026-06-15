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

              <div
                className={`buzzer-result${
                  buzzer.state?.winnerName ? ' has-winner' : ''
                }`}
              >
                <span>
                  {buzzer.state?.winnerName
                    ? 'Als Erstes gedrückt'
                    : buzzer.state?.isOpen
                      ? 'Buzzer ist freigegeben'
                      : 'Buzzer ist gesperrt'}
                </span>
                <strong>{buzzer.state?.winnerName ?? 'Noch niemand'}</strong>
              </div>

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

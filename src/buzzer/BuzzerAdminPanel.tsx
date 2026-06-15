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
        <span
          className={`buzzer-live-dot${
            buzzer.state?.buzzerVisible || buzzer.state?.textInputVisible
              ? ' active'
              : ''
          }`}
        />
        Interaktion
      </button>

      {open && (
        <section className="buzzer-console">
          <div className="buzzer-console-head">
            <div>
              <span>Spielleitung</span>
              <h2>Live-Interaktion</h2>
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

              <div className="interaction-toggles">
                <button
                  className={buzzer.state?.buzzerVisible ? 'enabled' : ''}
                  disabled={buzzer.busy}
                  onClick={() =>
                    buzzer.setFeature(
                      'buzzer',
                      !buzzer.state?.buzzerVisible,
                    )
                  }
                  type="button"
                >
                  <span />
                  <div>
                    <strong>Buzzer</strong>
                    <small>
                      {buzzer.state?.buzzerVisible ? 'Sichtbar' : 'Ausgeblendet'}
                    </small>
                  </div>
                </button>
                <button
                  className={buzzer.state?.textInputVisible ? 'enabled' : ''}
                  disabled={buzzer.busy}
                  onClick={() =>
                    buzzer.setFeature(
                      'text',
                      !buzzer.state?.textInputVisible,
                    )
                  }
                  type="button"
                >
                  <span />
                  <div>
                    <strong>Textfeld</strong>
                    <small>
                      {buzzer.state?.textInputVisible
                        ? 'Sichtbar'
                        : 'Ausgeblendet'}
                    </small>
                  </div>
                </button>
              </div>

              {buzzer.state?.buzzerVisible && (
                <section className="interaction-section">
                  <div className="buzzer-queue-head">
                    <div>
                      <span>Reihenfolge</span>
                      <strong>
                        {buzzer.state.isOpen
                          ? 'Runde läuft'
                          : 'Buzzer gesperrt'}
                      </strong>
                    </div>
                    <b>{buzzer.state.queue.length}</b>
                  </div>

                  <ol className="buzzer-queue">
                    {buzzer.state.queue.length ? (
                      buzzer.state.queue.map((entry) => (
                        <li key={entry.userId}>
                          <b>{entry.position}</b>
                          <strong>{entry.displayName}</strong>
                          <time>
                            {new Date(entry.buzzedAt).toLocaleTimeString(
                              'de-AT',
                              {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              },
                            )}
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
                      disabled={buzzer.busy || !buzzer.state.isOpen}
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
                </section>
              )}

              {buzzer.state?.textInputVisible && (
                <section className="interaction-section text-responses">
                  <div className="text-responses-head">
                    <div>
                      <span>Texteingaben</span>
                      <strong>{buzzer.state.textEntries.length} Antworten</strong>
                    </div>
                    <button
                      disabled={
                        buzzer.busy || buzzer.state.textEntries.length === 0
                      }
                      onClick={buzzer.clearTexts}
                      type="button"
                    >
                      Leeren
                    </button>
                  </div>
                  <ol>
                    {buzzer.state.textEntries.length ? (
                      buzzer.state.textEntries.map((entry) => (
                        <li key={entry.userId}>
                          <div>
                            <strong>{entry.displayName}</strong>
                            <time>
                              {new Date(entry.submittedAt).toLocaleTimeString(
                                'de-AT',
                                {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                },
                              )}
                            </time>
                          </div>
                          <p>{entry.content}</p>
                        </li>
                      ))
                    ) : (
                      <li className="empty">Noch keine Texte eingegangen.</li>
                    )}
                  </ol>
                </section>
              )}
              {buzzer.error && <p className="buzzer-error">{buzzer.error}</p>}
            </>
          )}
        </section>
      )}
    </aside>
  )
}

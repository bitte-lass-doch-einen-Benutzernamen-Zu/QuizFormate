import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useBuzzer } from '../buzzer/useBuzzer'
import { getSupabaseClient } from '../lib/supabase'
import { useAuth } from './authContext'
import '../buzzer/buzzer.css'

export default function ViewerPage() {
  const { guestAccess, session, signOut } = useAuth()
  const signOutRef = useRef(signOut)
  const buzzer = useBuzzer(guestAccess?.roomId)
  const [textDraft, setTextDraft] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)
  const ownEntry = buzzer.state?.queue.find(
    (entry) => entry.userId === session?.user.id,
  )
  const isWinner = ownEntry?.position === 1
  const canPress = Boolean(
    buzzer.state?.buzzerVisible &&
      buzzer.state.isOpen &&
      !ownEntry &&
      !buzzer.busy,
  )
  const ownText = buzzer.state?.textEntries.find(
    (entry) => entry.userId === session?.user.id,
  )

  useEffect(() => {
    signOutRef.current = signOut
  }, [signOut])

  useEffect(() => {
    const userId = session?.user.id
    if (!userId) return

    let active = true
    let leaving = false
    let cleanupChannel = () => {}

    const leaveRemovedSession = () => {
      if (leaving || !active) return
      leaving = true
      void signOutRef.current()
    }

    getSupabaseClient().then((client) => {
      if (!active) return
      const checkMembership = async () => {
        const { data, error } = await client
          .from('game_night_participants')
          .select('room_id')
          .eq('user_id', userId)
          .maybeSingle()

        if (!error && !data) leaveRemovedSession()
      }

      void checkMembership()
      const timer = window.setInterval(checkMembership, 10000)
      const channel = client
        .channel(`participant:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'game_night_participants',
            filter: `user_id=eq.${userId}`,
          },
          leaveRemovedSession,
        )
        .subscribe()

      cleanupChannel = () => {
        window.clearInterval(timer)
        void client.removeChannel(channel)
      }
    })

    return () => {
      active = false
      cleanupChannel()
    }
  }, [session?.user.id])

  const submitText = async (event: FormEvent) => {
    event.preventDefault()
    const content = textDraft.trim()
    if (!content) return
    const result = await buzzer.submitText(content)
    if (result) setTextDraft('')
  }

  const status = buzzer.loading
    ? 'Verbindung wird hergestellt'
    : ownEntry
      ? ownEntry.position === 1
        ? 'Du warst zuerst'
        : `Du bist auf Platz ${ownEntry.position}`
      : buzzer.state?.isOpen
        ? 'Der Buzzer ist frei'
        : 'Warte auf die Spielleitung'
  const cameraRoomUrl = guestAccess
    ? `https://meet.jit.si/${encodeURIComponent(
        `quiz-formate-ddf-${guestAccess.roomId}`,
      )}#config.prejoinPageEnabled=false&config.startWithAudioMuted=true`
    : ''

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

      <section
        className={`buzzer-stage${
          buzzer.state?.buzzerVisible && buzzer.state?.textInputVisible
            ? ' split'
            : ''
        }`}
      >
        <div className="buzzer-player">
          Du spielst als <strong>{guestAccess?.displayName}</strong>
          <b>{buzzer.state?.ownScore ?? 0} Punkte</b>
        </div>

        {buzzer.state?.morphGuessMode === 'one' && (
          <div className="morph-one-guess-notice" role="status">
            <strong>Nur noch 1 Champion!</strong>
            <span>Ein richtiger Champion reicht jetzt und ist 1 Punkt wert.</span>
          </div>
        )}

        {!buzzer.loading &&
          !buzzer.state?.buzzerVisible &&
          !buzzer.state?.textInputVisible && (
            <div className="interactions-waiting">
              <span>Bereit</span>
              <h2>Warte auf die Spielleitung</h2>
              <p>Buzzer und Texteingabe sind derzeit ausgeblendet.</p>
            </div>
          )}

        {buzzer.state?.buzzerVisible && (
          <section className="viewer-interaction-module">
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

            {Boolean(buzzer.state.queue.length) && (
              <div className="viewer-buzzer-queue">
                <span>Aktuelle Reihenfolge</span>
                <ol>
                  {buzzer.state.queue.map((entry) => (
                    <li
                      className={
                        entry.userId === session?.user.id ? 'you' : ''
                      }
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
          </section>
        )}

        {buzzer.state?.textInputVisible && (
          <section className="viewer-text-module">
            <span>Deine Antwort</span>
            <h2>Text an die Spielleitung</h2>
            <p>Du kannst deine Einsendung jederzeit aktualisieren.</p>
            <form onSubmit={submitText}>
              <textarea
                maxLength={500}
                onChange={(event) => setTextDraft(event.target.value)}
                placeholder="Antwort oder Nachricht eingeben..."
                rows={5}
                value={textDraft}
              />
              <div>
                <small>{textDraft.length} / 500</small>
                <button
                  disabled={buzzer.busy || !textDraft.trim()}
                  type="submit"
                >
                  {buzzer.busy ? 'Sendet...' : ownText ? 'Aktualisieren' : 'Senden'}
                </button>
              </div>
            </form>
            {ownText && (
              <div className="own-text-response" aria-live="polite">
                <span>Gesendet</span>
                <p>{ownText.content}</p>
              </div>
            )}
          </section>
        )}

        {buzzer.error && <p className="buzzer-error">{buzzer.error}</p>}
        {buzzer.state?.buzzerVisible && (
          <p className="buzzer-hint">
            Der Server vergibt alle Plätze atomar in der echten Reihenfolge.
          </p>
        )}

        {guestAccess && (
          <section className="viewer-camera-module">
            <div>
              <span>Kamera</span>
              <h2>Der Duemmste fliegt</h2>
              <p>Oeffne deine Kamera, wenn die Spielleitung den Kamera-Raum nutzt.</p>
            </div>
            <button onClick={() => setCameraOpen((open) => !open)} type="button">
              {cameraOpen ? 'Kamera-Raum schliessen' : 'Kamera-Raum oeffnen'}
            </button>
            <div className="viewer-camera-actions">
              <button
                onClick={() => void navigator.clipboard.writeText(cameraRoomUrl)}
                type="button"
              >
                Link kopieren
              </button>
              <a href={cameraRoomUrl} rel="noreferrer" target="_blank">
                Extern oeffnen
              </a>
            </div>
            {cameraOpen && (
              <iframe
                allow="camera; microphone; fullscreen; display-capture"
                src={cameraRoomUrl}
                title="Kamera-Raum"
              />
            )}
          </section>
        )}
      </section>
    </main>
  )
}

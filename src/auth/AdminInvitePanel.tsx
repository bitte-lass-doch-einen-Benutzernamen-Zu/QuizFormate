import { useState, type FormEvent } from 'react'
import { getErrorMessage } from '../lib/errors'
import { useAuth } from './authContext'
import './auth.css'

export default function AdminInvitePanel() {
  const { createInvite, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('Discord Spieleabend')
  const [hours, setHours] = useState(8)
  const [invite, setInvite] = useState<{
    code: string
    expiresAt: string
  } | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      setInvite(await createInvite(title, hours))
    } catch (reason) {
      setError(getErrorMessage(reason, 'Code konnte nicht erstellt werden.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <aside className="admin-session">
      <button onClick={() => setOpen((current) => !current)} type="button">
        Einladung
      </button>
      <button onClick={signOut} type="button">Abmelden</button>

      {open && (
        <section className="invite-popover">
          <h2>Persönlichen Zugang erstellen</h2>
          <form onSubmit={submit}>
            <label>
              Titel
              <input
                maxLength={80}
                onChange={(event) => setTitle(event.target.value)}
                required
                value={title}
              />
            </label>
            <label>
              Gültig für Stunden
              <input
                max={24}
                min={1}
                onChange={(event) => setHours(Number(event.target.value))}
                required
                type="number"
                value={hours}
              />
            </label>
            <button disabled={submitting} type="submit">
              {submitting ? 'Erstelle...' : 'Persönlichen Code erstellen'}
            </button>
          </form>
          {error && <p className="access-error">{error}</p>}
          {invite && (
            <div className="invite-result">
              <span>Invite-Code</span>
              <strong>{invite.code}</strong>
              <small>Für genau einen aktiven Teilnehmer</small>
              <small>
                Gültig bis {new Date(invite.expiresAt).toLocaleString('de-AT')}
              </small>
            </div>
          )}
        </section>
      )}
    </aside>
  )
}

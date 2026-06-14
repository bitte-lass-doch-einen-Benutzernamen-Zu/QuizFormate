import { useState, type FormEvent } from 'react'
import { useAuth } from './authContext'
import './auth.css'

export default function ResetPasswordPage() {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.')
      return
    }
    if (password !== confirmation) {
      setError('Die Passwörter stimmen nicht überein.')
      return
    }

    setSubmitting(true)
    try {
      await updatePassword(password)
      setSuccess(true)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Das Passwort konnte nicht geändert werden.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="access-page">
      <section className="access-card">
        <div className="access-brand">
          <span>Quiz Formate</span>
          <h1>Neues Passwort</h1>
          <p>Lege ein neues Passwort für deinen Admin-Zugang fest.</p>
        </div>

        {success ? (
          <div className="access-success">
            Passwort gespeichert. Du kannst dich jetzt als <b>admin</b>{' '}
            anmelden.
            <a href="/">Zum Admin-Login</a>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label>
              Neues Passwort
              <input
                autoComplete="new-password"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            <label>
              Passwort wiederholen
              <input
                autoComplete="new-password"
                minLength={8}
                onChange={(event) => setConfirmation(event.target.value)}
                required
                type="password"
                value={confirmation}
              />
            </label>
            {error && <p className="access-error">{error}</p>}
            <button disabled={submitting} type="submit">
              {submitting ? 'Speichere...' : 'Passwort speichern'}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}

import { useState, type FormEvent } from 'react'
import { useAuth } from './authContext'
import './auth.css'

export default function AccessPage() {
  const { configured, signInAdmin, joinWithCode } = useAuth()
  const [mode, setMode] = useState<'guest' | 'admin'>('guest')
  const [displayName, setDisplayName] = useState('')
  const [code, setCode] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (mode === 'admin') {
        await signInAdmin(username, password)
      } else {
        await joinWithCode(code, displayName)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Anmeldung fehlgeschlagen.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="access-page">
      <section className="access-card">
        <div className="access-brand">
          <span>Quiz Formate</span>
          <h1>{mode === 'guest' ? 'Spieleabend beitreten' : 'Admin Login'}</h1>
          <p>
            {mode === 'guest'
              ? 'Nutze den Code, den du vom Host erhalten hast.'
              : 'Nur die Spielleitung kann Formate und Spielstände steuern.'}
          </p>
        </div>

        {!configured ? (
          <div className="access-warning">
            Supabase ist noch nicht konfiguriert. Trage die beiden
            Vite-Umgebungsvariablen aus <code>.env.example</code> ein.
          </div>
        ) : (
          <form onSubmit={submit}>
            {mode === 'guest' ? (
              <>
                <label>
                  Dein Name
                  <input
                    autoComplete="nickname"
                    maxLength={40}
                    onChange={(event) => setDisplayName(event.target.value)}
                    required
                    value={displayName}
                  />
                </label>
                <label>
                  Invite-Code
                  <input
                    autoCapitalize="characters"
                    autoComplete="one-time-code"
                    maxLength={8}
                    onChange={(event) =>
                      setCode(event.target.value.toUpperCase())
                    }
                    required
                    value={code}
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  Benutzername
                  <input
                    autoCapitalize="none"
                    autoComplete="username"
                    onChange={(event) => setUsername(event.target.value)}
                    required
                    value={username}
                  />
                </label>
                <label>
                  Passwort
                  <input
                    autoComplete="current-password"
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    type="password"
                    value={password}
                  />
                </label>
              </>
            )}

            {error && <p className="access-error">{error}</p>}
            <button disabled={submitting} type="submit">
              {submitting
                ? 'Bitte warten...'
                : mode === 'guest'
                  ? 'Beitreten'
                  : 'Anmelden'}
            </button>
          </form>
        )}

        <button
          className="access-mode"
          onClick={() => {
            setError('')
            setMode((current) => (current === 'guest' ? 'admin' : 'guest'))
          }}
          type="button"
        >
          {mode === 'guest' ? 'Admin Login' : 'Mit Invite-Code beitreten'}
        </button>
      </section>
    </main>
  )
}

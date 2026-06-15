import { useEffect, useMemo, useState } from 'react'
import {
  loadLeagueChampions,
  type LeagueChampion,
} from '../formats/morph-duell/data/leagueChampions'
import './formats.css'

export default function MorphDuellPage() {
  const [champions, setChampions] = useState<LeagueChampion[]>([])
  const [version, setVersion] = useState('')
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    loadLeagueChampions()
      .then((result) => {
        if (!active) return
        setChampions(result.champions)
        setVersion(result.version)
      })
      .catch((reason) => {
        if (!active) return
        setError(
          reason instanceof Error
            ? reason.message
            : 'Champion-Bibliothek konnte nicht geladen werden.',
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const filteredChampions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('de')
    if (!normalizedQuery) return champions
    return champions.filter((champion) =>
      `${champion.name} ${champion.title} ${champion.roles.join(' ')}`
        .toLocaleLowerCase('de')
        .includes(normalizedQuery),
    )
  }, [champions, query])

  const selectedChampions = selectedIds
    .map((id) => champions.find((champion) => champion.id === id))
    .filter((champion): champion is LeagueChampion => Boolean(champion))

  const toggleChampion = (championId: string) => {
    setSelectedIds((current) => {
      if (current.includes(championId)) {
        return current.filter((id) => id !== championId)
      }
      return current.length < 2 ? [...current, championId] : [current[1], championId]
    })
  }

  return (
    <main className="morph-library-page">
      <div className="formats-grid-bg" aria-hidden="true" />
      <a className="back-to-formats" href="/">← Alle Formate</a>

      <header className="morph-library-header">
        <div>
          <span className="formats-eyebrow">Charakter-Morph</span>
          <h1>Champion Studio</h1>
          <p>
            Wähle zwei League-of-Legends-Champions als Grundlage für eine
            Morphduell-Frage.
          </p>
        </div>
        <div className="data-dragon-status">
          <span />
          {version ? `Data Dragon ${version}` : 'Data Dragon'}
        </div>
      </header>

      <section className="morph-selection">
        {[0, 1].map((slot) => {
          const champion = selectedChampions[slot]
          return (
            <article className={`morph-slot${champion ? ' filled' : ''}`} key={slot}>
              {champion ? (
                <>
                  <img src={champion.splash} alt="" />
                  <div>
                    <span>Charakter {slot + 1}</span>
                    <strong>{champion.name}</strong>
                    <small>{champion.title}</small>
                  </div>
                  <button
                    onClick={() => toggleChampion(champion.id)}
                    type="button"
                    aria-label={`${champion.name} entfernen`}
                  >
                    ×
                  </button>
                </>
              ) : (
                <div className="empty-morph-slot">
                  <b>{slot + 1}</b>
                  <span>Champion auswählen</span>
                </div>
              )}
            </article>
          )
        })}

        <div className={`fusion-readiness${selectedChampions.length === 2 ? ' ready' : ''}`}>
          <span>{selectedChampions.length} / 2</span>
          <strong>
            {selectedChampions.length === 2
              ? 'Paar für Fusion bereit'
              : 'Zwei Champions auswählen'}
          </strong>
          <small>
            Das finale Morph-Bild wird als eigenes Quiz-Asset gespeichert.
          </small>
        </div>
      </section>

      <section className="champion-library">
        <div className="champion-library-toolbar">
          <div>
            <span>League of Legends</span>
            <h2>Champion-Bibliothek</h2>
          </div>
          <label>
            <span>Champion suchen</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, Titel oder Rolle..."
              type="search"
              value={query}
            />
          </label>
        </div>

        {loading ? (
          <div className="champion-library-message">Champions werden geladen...</div>
        ) : error ? (
          <div className="champion-library-message error">{error}</div>
        ) : (
          <>
            <div className="champion-library-count">
              {filteredChampions.length} von {champions.length} Champions
            </div>
            <div className="champion-grid">
              {filteredChampions.map((champion) => {
                const selectedIndex = selectedIds.indexOf(champion.id)
                return (
                  <button
                    className={selectedIndex >= 0 ? 'selected' : ''}
                    key={champion.id}
                    onClick={() => toggleChampion(champion.id)}
                    type="button"
                  >
                    <img
                      alt={champion.name}
                      loading="lazy"
                      src={champion.square}
                    />
                    <span>
                      <strong>{champion.name}</strong>
                      <small>{champion.roles.join(' · ')}</small>
                    </span>
                    {selectedIndex >= 0 && <b>{selectedIndex + 1}</b>}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </section>

      <footer className="riot-attribution">
        Morphduell was created under Riot Games&apos; Legal Jibber Jabber policy
        using assets owned by Riot Games. Riot Games does not endorse or sponsor
        this project.
      </footer>
    </main>
  )
}

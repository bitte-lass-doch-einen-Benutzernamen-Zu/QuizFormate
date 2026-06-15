import { useEffect, useMemo, useState } from 'react'
import {
  generateMorph,
  type GeneratedMorph,
} from '../formats/morph-duell/api/generateMorph'
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
  const [generating, setGenerating] = useState(false)
  const [libraryError, setLibraryError] = useState('')
  const [generationError, setGenerationError] = useState('')
  const [activeMorph, setActiveMorph] = useState<GeneratedMorph | null>(null)

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
        setLibraryError(
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

  const activeChampions = activeMorph
    ? [activeMorph.firstChampion.id, activeMorph.secondChampion.id]
        .map((id) => champions.find((champion) => champion.id === id))
        .filter((champion): champion is LeagueChampion => Boolean(champion))
    : []

  const toggleChampion = (championId: string) => {
    if (generating) return
    setActiveMorph(null)
    setGenerationError('')
    setSelectedIds((current) => {
      if (current.includes(championId)) {
        return current.filter((id) => id !== championId)
      }
      return current.length < 2 ? [...current, championId] : [current[1], championId]
    })
  }

  const createMorph = async () => {
    if (selectedChampions.length !== 2 || generating) return

    setGenerating(true)
    setGenerationError('')
    setActiveMorph(null)
    try {
      const morph = await generateMorph(
        selectedChampions[0].id,
        selectedChampions[1].id,
      )
      setActiveMorph(morph)
    } catch (reason) {
      setGenerationError(
        reason instanceof Error
          ? reason.message
          : 'Die KI-Fusion ist fehlgeschlagen.',
      )
    } finally {
      setGenerating(false)
    }
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
            Wähle zwei League-of-Legends-Champions. Das Fusionsbild wird erst
            erzeugt, wenn du auf „Mit KI fusionieren“ klickst.
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
                    disabled={generating}
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
            {generating
              ? 'KI-Fusion läuft'
              : selectedChampions.length === 2
                ? 'Paar für Fusion bereit'
                : 'Zwei Champions auswählen'}
          </strong>
          <small>
            {generating
              ? 'Die beiden Referenzbilder werden gerade zu einer neuen Figur verschmolzen. Das kann etwa eine Minute dauern.'
              : 'Jeder Klick erzeugt eine neue Variante und speichert sie als Quizkarte.'}
          </small>
          <button
            disabled={selectedChampions.length !== 2 || generating}
            onClick={createMorph}
            type="button"
          >
            {generating ? 'Fusion wird generiert...' : 'Mit KI fusionieren'}
          </button>
          {generationError && (
            <p className="fusion-error" role="alert">{generationError}</p>
          )}
        </div>
      </section>

      {activeMorph && activeChampions.length === 2 && (
        <section className="generated-morph">
          <div className="generated-morph-head">
            <div>
              <span>Neue KI-Quizkarte</span>
              <h2>Wer steckt im Morph?</h2>
            </div>
            <div>
              <a href={activeMorph.imageUrl} download target="_blank" rel="noreferrer">
                Bild öffnen
              </a>
              <button onClick={() => setActiveMorph(null)} type="button">
                Schließen
              </button>
            </div>
          </div>
          <div className="generated-morph-image">
            <img
              alt={`Morph aus ${activeChampions[0].name} und ${activeChampions[1].name}`}
              src={activeMorph.imageUrl}
            />
            <span>Morphduell</span>
          </div>
          <details>
            <summary>Auflösung anzeigen</summary>
            <div>
              {activeChampions.map((champion) => (
                <article key={champion.id}>
                  <img alt={champion.name} src={champion.square} />
                  <strong>{champion.name}</strong>
                </article>
              ))}
            </div>
          </details>
          <details>
            <summary>Hinweise anzeigen</summary>
            <ol className="morph-hints">
              <li>
                Die Rollen der beiden Champions sind{' '}
                {activeChampions
                  .map((champion) => champion.roles.join('/'))
                  .join(' und ')}.
              </li>
              <li>
                Die Titel lauten „{activeChampions[0].title}“ und „
                {activeChampions[1].title}“.
              </li>
              <li>Beide gesuchten Namen sind in der Auflösung sichtbar.</li>
            </ol>
          </details>
        </section>
      )}

      <section className="champion-library">
        <div className="champion-library-toolbar">
          <div>
            <span>League of Legends</span>
            <h2>Champion-Bibliothek</h2>
          </div>
          <label>
            <span>Champion suchen</span>
            <input
              disabled={generating}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, Titel oder Rolle..."
              type="search"
              value={query}
            />
          </label>
        </div>

        {loading ? (
          <div className="champion-library-message">Champions werden geladen...</div>
        ) : libraryError ? (
          <div className="champion-library-message error">{libraryError}</div>
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
                    disabled={generating}
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

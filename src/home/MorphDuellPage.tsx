import { useEffect, useMemo, useState } from 'react'
import {
  generateMorph,
  hasMorphOpenAIKey,
  setMorphOpenAIKey,
  type GeneratedMorph,
  type MorphDifficulty,
} from '../formats/morph-duell/api/generateMorph'
import {
  loadLeagueChampions,
  type LeagueChampion,
} from '../formats/morph-duell/data/leagueChampions'
import './formats.css'

const difficulties: Array<{
  value: MorphDifficulty
  label: string
  description: string
}> = [
  {
    value: 'easy',
    label: 'Leicht',
    description: 'Ikonische Farben und Merkmale bleiben gut erkennbar.',
  },
  {
    value: 'medium',
    label: 'Mittel',
    description: 'Gesicht, Silhouette und Outfit werden stärker verändert.',
  },
  {
    value: 'hard',
    label: 'Schwer',
    description: 'Nur subtile Merkmale bleiben in einem neuen Design verborgen.',
  },
]

export default function MorphDuellPage() {
  const [champions, setChampions] = useState<LeagueChampion[]>([])
  const [version, setVersion] = useState('')
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [difficulty, setDifficulty] = useState<MorphDifficulty>('medium')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [providerConfigured, setProviderConfigured] = useState<boolean | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [savingApiKey, setSavingApiKey] = useState(false)
  const [configurationError, setConfigurationError] = useState('')
  const [libraryError, setLibraryError] = useState('')
  const [generationError, setGenerationError] = useState('')
  const [activeMorph, setActiveMorph] = useState<GeneratedMorph | null>(null)
  const [revealedHints, setRevealedHints] = useState(0)

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

  useEffect(() => {
    let active = true
    hasMorphOpenAIKey()
      .then((configured) => {
        if (active) setProviderConfigured(configured)
      })
      .catch(() => {
        if (active) setProviderConfigured(false)
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
    setRevealedHints(0)
    try {
      const morph = await generateMorph(
        selectedChampions[0].id,
        selectedChampions[1].id,
        difficulty,
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

  const saveProviderConfiguration = async () => {
    if (!apiKey.trim() || savingApiKey) return
    setSavingApiKey(true)
    setConfigurationError('')
    try {
      await setMorphOpenAIKey(apiKey)
      setApiKey('')
      setProviderConfigured(true)
      setGenerationError('')
    } catch (reason) {
      setConfigurationError(
        reason instanceof Error
          ? reason.message
          : 'Der API-Key konnte nicht gespeichert werden.',
      )
    } finally {
      setSavingApiKey(false)
    }
  }

  const activeHints = activeChampions.length === 2
    ? [
        `Die Rollen der beiden Champions sind ${activeChampions
          .map((champion) => champion.roles.join('/'))
          .join(' und ')}.`,
        `Die Titel lauten „${activeChampions[0].title}“ und „${activeChampions[1].title}“.`,
        `Die Anfangsbuchstaben der gesuchten Champions sind ${activeChampions[0].name[0]} und ${activeChampions[1].name[0]}.`,
      ]
    : []

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

      {providerConfigured === false && (
        <section className="morph-provider-setup">
          <div>
            <span>Einmalige Einrichtung</span>
            <h2>KI-Bildgenerierung verbinden</h2>
            <p>
              Hinterlege einen OpenAI API-Key. Er wird verschlüsselt in
              Supabase Vault gespeichert und nicht im Browser behalten.
            </p>
          </div>
          <div className="morph-provider-form">
            <label>
              <span>OpenAI API-Key</span>
              <input
                autoComplete="off"
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="sk-..."
                type="password"
                value={apiKey}
              />
            </label>
            <button
              disabled={!apiKey.trim() || savingApiKey}
              onClick={saveProviderConfiguration}
              type="button"
            >
              {savingApiKey ? 'Wird gespeichert...' : 'Sicher verbinden'}
            </button>
            {configurationError && (
              <p role="alert">{configurationError}</p>
            )}
            <small>
              API-Nutzung wird von OpenAI separat verrechnet. Ein
              ChatGPT-Abonnement enthält nicht automatisch API-Guthaben.
            </small>
          </div>
        </section>
      )}

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
              ? 'Die beiden Referenzbilder werden zu einer einfachen Charakteransicht auf schwarzem Hintergrund verschmolzen.'
              : 'Jeder Klick erzeugt eine neue Variante und speichert sie als Quizkarte.'}
          </small>
          <fieldset className="morph-difficulty" disabled={generating}>
            <legend>Schwierigkeit</legend>
            {difficulties.map((option) => (
              <label
                className={difficulty === option.value ? 'selected' : ''}
                key={option.value}
              >
                <input
                  checked={difficulty === option.value}
                  name="morph-difficulty"
                  onChange={() => setDifficulty(option.value)}
                  type="radio"
                  value={option.value}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <button
            disabled={
              selectedChampions.length !== 2 ||
              generating ||
              providerConfigured !== true
            }
            onClick={createMorph}
            type="button"
          >
            {generating
              ? 'Fusion wird generiert...'
              : providerConfigured === false
                ? 'Zuerst KI verbinden'
                : 'Mit KI fusionieren'}
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
              <span>
                Neue KI-Quizkarte ·{' '}
                {difficulties.find(
                  (option) => option.value === activeMorph.difficulty,
                )?.label}
              </span>
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
          <div className="generated-morph-stage">
            <div className="generated-morph-image">
              <img
                alt={`Morph aus ${activeChampions[0].name} und ${activeChampions[1].name}`}
                src={activeMorph.imageUrl}
              />
              <span>Morphduell</span>
            </div>
            <aside className="morph-game-tools">
              <div className="morph-game-tools-head">
                <span>Spielleitung</span>
                <h3>Hinweise</h3>
                <small>{revealedHints} / {activeHints.length} aufgedeckt</small>
              </div>
              <ol className="morph-hints">
                {activeHints.slice(0, revealedHints).map((hint) => (
                  <li key={hint}>{hint}</li>
                ))}
              </ol>
              {revealedHints === 0 && (
                <p className="morph-hints-empty">
                  Decke nur dann einen Hinweis auf, wenn das Bild zu schwer ist.
                </p>
              )}
              <button
                disabled={revealedHints >= activeHints.length}
                onClick={() => setRevealedHints((current) => current + 1)}
                type="button"
              >
                {revealedHints < activeHints.length
                  ? `Hinweis ${revealedHints + 1} aufdecken`
                  : 'Alle Hinweise aufgedeckt'}
              </button>
              <details className="morph-solution">
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
            </aside>
          </div>
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

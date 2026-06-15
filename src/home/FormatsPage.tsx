import './formats.css'

type FormatCard = {
  title: string
  kicker: string
  description: string
  accent: string
  href?: string
  badge?: string
  symbol: string
}

const formats: FormatCard[] = [
  {
    title: 'Quizduell',
    kicker: 'Wissen & Taktik',
    description:
      'Das klassische Punkteboard mit Teams, Kategorien und Live-Buzzer.',
    accent: '#00f5d4',
    href: '/quizduell',
    badge: 'Spielbereit',
    symbol: 'Q',
  },
  {
    title: 'Morphduell',
    kicker: 'Charaktere erkennen',
    description:
      'Zwei Figuren verschmelzen. Hinweise aufdecken und den Morph erraten.',
    accent: '#ff4ecd',
    href: '/morphduell',
    badge: 'Spielbereit',
    symbol: 'M',
  },
  {
    title: 'Bilderraten',
    kicker: 'Visuelles Quiz',
    description: 'Bildausschnitte, Zoomstufen und überraschende Auflösungen.',
    accent: '#a78bfa',
    badge: 'Geplant',
    symbol: '01',
  },
  {
    title: 'Voice Quiz',
    kicker: 'Hören & Erkennen',
    description:
      'League-Voicelines abspielen, Champions erraten und Punkte vergeben.',
    accent: '#4cc9f0',
    href: '/voicequiz',
    badge: 'Spielbereit',
    symbol: '02',
  },
  {
    title: 'Schätzfragen',
    kicker: 'Nah dran gewinnt',
    description: 'Zahlen schätzen, Antworten vergleichen und Punkte verteilen.',
    accent: '#ffb703',
    badge: 'Geplant',
    symbol: '03',
  },
]

export default function FormatsPage() {
  return (
    <main className="formats-page">
      <div className="formats-grid-bg" aria-hidden="true" />
      <header className="formats-hero">
        <div>
          <span className="formats-eyebrow">Quiz Formate</span>
          <h1>Was spielen wir heute?</h1>
          <p>
            Wähle ein Format für den aktiven Spieleabend. Einladung und
            Live-Buzzer bleiben formatübergreifend verbunden.
          </p>
        </div>
        <div className="formats-live">
          <span />
          Spielleitung online
        </div>
      </header>

      <section className="format-card-grid" aria-label="Verfügbare Quizformate">
        {formats.map((format, index) => {
          const content = (
            <>
              <div className="format-card-top">
                <span>{format.kicker}</span>
                <b>{format.badge}</b>
              </div>
              <div className="format-symbol">{format.symbol}</div>
              <div>
                <small>Format {String(index + 1).padStart(2, '0')}</small>
                <h2>{format.title}</h2>
                <p>{format.description}</p>
              </div>
              <strong className="format-action">
                {format.href ? 'Format öffnen' : 'Kommt später'}
                <span aria-hidden="true">→</span>
              </strong>
            </>
          )

          return format.href ? (
            <a
              className="format-card available"
              href={format.href}
              key={format.title}
              style={{ '--format-accent': format.accent } as React.CSSProperties}
            >
              {content}
            </a>
          ) : (
            <article
              className="format-card disabled"
              key={format.title}
              style={{ '--format-accent': format.accent } as React.CSSProperties}
            >
              {content}
            </article>
          )
        })}
      </section>
    </main>
  )
}

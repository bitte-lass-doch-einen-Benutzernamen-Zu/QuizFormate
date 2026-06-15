import './formats.css'

export default function MorphDuellPage() {
  return (
    <main className="morph-preview-page">
      <div className="formats-grid-bg" aria-hidden="true" />
      <a className="back-to-formats" href="/">← Alle Formate</a>
      <section className="morph-preview">
        <span className="formats-eyebrow">Nächstes Format</span>
        <div className="morph-mark">
          <i>M</i>
          <i>D</i>
        </div>
        <h1>Morphduell</h1>
        <p>
          Die Formatseite ist vorbereitet. Hier bauen wir als Nächstes
          Charakterauswahl, Morph-Bild, Hinweise und Punktevergabe ein.
        </p>
        <div className="morph-roadmap">
          <span>Zwei Charaktere</span>
          <span>Hinweise</span>
          <span>Sinkende Punkte</span>
          <span>Auflösung</span>
        </div>
      </section>
    </main>
  )
}

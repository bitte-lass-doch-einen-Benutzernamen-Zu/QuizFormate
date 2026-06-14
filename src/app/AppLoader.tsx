export default function AppLoader() {
  return (
    <main className="app-loader" aria-busy="true" aria-label="App wird geladen">
      <div className="app-loader-mark" />
      <strong>Quiz Formate</strong>
      <span>Wird geladen...</span>
    </main>
  )
}

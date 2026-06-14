import { resolveRoute } from './app/routes'

function App() {
  return resolveRoute(window.location.pathname)
}

export default App

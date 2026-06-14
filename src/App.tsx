import AccessPage from './auth/AccessPage'
import AdminInvitePanel from './auth/AdminInvitePanel'
import { useAuth } from './auth/authContext'
import ResetPasswordPage from './auth/ResetPasswordPage'
import ViewerPage from './auth/ViewerPage'
import { resolveRoute } from './app/routes'

function App() {
  const { configured, loading, role } = useAuth()

  if (window.location.pathname === '/reset-password') {
    return <ResetPasswordPage />
  }
  if (loading) return <main aria-busy="true" />
  if (!configured || !role) return <AccessPage />
  if (role === 'viewer') return <ViewerPage />

  return (
    <>
      <AdminInvitePanel />
      {resolveRoute(window.location.pathname)}
    </>
  )
}

export default App

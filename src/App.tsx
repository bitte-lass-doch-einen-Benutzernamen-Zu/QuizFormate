import { lazy, Suspense } from 'react'
import AppLoader from './app/AppLoader'
import AccessPage from './auth/AccessPage'
import { useAuth } from './auth/authContext'
import { resolveRoute } from './app/routes'

const AdminInvitePanel = lazy(() => import('./auth/AdminInvitePanel'))
const BuzzerAdminPanel = lazy(() => import('./buzzer/BuzzerAdminPanel'))
const ResetPasswordPage = lazy(() => import('./auth/ResetPasswordPage'))
const ViewerPage = lazy(() => import('./auth/ViewerPage'))

function App() {
  const { configured, loading, role } = useAuth()

  if (window.location.pathname === '/reset-password') {
    return (
      <Suspense fallback={<AppLoader />}>
        <ResetPasswordPage />
      </Suspense>
    )
  }
  if (loading) return <AppLoader />
  if (!configured || !role) return <AccessPage />
  if (role === 'viewer') {
    return (
      <Suspense fallback={<AppLoader />}>
        <ViewerPage />
      </Suspense>
    )
  }

  return (
    <Suspense fallback={<AppLoader />}>
      <AdminInvitePanel />
      <BuzzerAdminPanel />
      {resolveRoute(window.location.pathname)}
    </Suspense>
  )
}

export default App

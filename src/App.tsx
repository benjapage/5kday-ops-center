import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { AppShell } from '@/components/layout/AppShell'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import MetaAssets from '@/pages/MetaAssets'
import Financial from '@/pages/Financial'
import Pipeline from '@/pages/Pipeline'
import Team from '@/pages/Team'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth()
  if (isLoading) return <LoadingSpinner fullScreen />
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { session, isLoading } = useAuth()

  if (isLoading) return <LoadingSpinner fullScreen />

  return (
    <Routes>
      <Route
        path="/login"
        element={session ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/meta" element={<MetaAssets />} />
        <Route path="/financial" element={<Financial />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/team" element={<Team />} />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

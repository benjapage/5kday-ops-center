import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Toaster } from '@/components/ui/sonner'

export function AppShell() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8FAFC' }}>
      <Sidebar />
      <main className="ml-64 min-h-screen" role="main" aria-label="Contenido principal">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
      <Toaster richColors position="top-right" />
    </div>
  )
}

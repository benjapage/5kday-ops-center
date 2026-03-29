import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Toaster } from '@/components/ui/sonner'

export function AppShell() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0a0f1a]">
      <Sidebar />
      <main
        className="min-h-screen transition-all duration-300 pt-14 md:pt-0 md:ml-[68px]"
        role="main"
        aria-label="Contenido principal"
      >
        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </main>
      <Toaster richColors position="top-right" />
    </div>
  )
}

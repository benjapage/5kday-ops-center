import { useState, useCallback, useEffect, useRef } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { WelcomeScreen } from './WelcomeScreen'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { Toaster } from '@/components/ui/sonner'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

const WELCOME_KEY = '5kday-welcome-shown'
const BAN_CHECK_INTERVAL = 15 * 60 * 1000 // 15 minutes

export function AppShell() {
  const { profile, user } = useAuth()

  const welcomeDisabled = localStorage.getItem('5kday-welcome-disabled') === 'true'
  const alreadyShown = sessionStorage.getItem(WELCOME_KEY) === 'true'

  const [showWelcome, setShowWelcome] = useState(!welcomeDisabled && !alreadyShown)
  const [chatOpen, setChatOpen] = useState(false)
  const banCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const handleWelcomeComplete = useCallback(() => {
    sessionStorage.setItem(WELCOME_KEY, 'true')
    setShowWelcome(false)
  }, [])

  // Background ban detection — runs every 15 min while app is open
  useEffect(() => {
    async function checkBans() {
      try {
        const res = await fetch('/api/manychat-check')
        if (!res.ok) return
        const data = await res.json()
        const banned = (data.details || []).filter((d: any) => d.action === 'BANNED')
        const flagged = (data.details || []).filter((d: any) => d.action === 'FLAGGED')

        for (const b of banned) {
          toast.error(`NUMERO BANEADO: ${b.phone}`, {
            description: `Detectado automaticamente. Tarea urgente creada.`,
            duration: 30000,
          })
        }
        for (const f of flagged) {
          toast.warning(`Posible problema: ${f.phone}`, {
            description: `ManyChat status: ${f.mcStatus || 'desconectado'}. Verifica en Activos Meta.`,
            duration: 15000,
          })
        }
      } catch {}
    }

    // Run immediately on app load
    checkBans()

    // Then every 15 minutes
    banCheckRef.current = setInterval(checkBans, BAN_CHECK_INTERVAL)
    return () => { if (banCheckRef.current) clearInterval(banCheckRef.current) }
  }, [])

  const firstName = profile?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'crack'

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0a0f1a]">
      {showWelcome && <WelcomeScreen name={firstName} onComplete={handleWelcomeComplete} />}
      <Sidebar onChatToggle={() => setChatOpen(prev => !prev)} />
      <main
        className="min-h-screen transition-all duration-300 pt-14 md:pt-0 md:ml-[68px]"
        role="main"
        aria-label="Contenido principal"
      >
        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </main>
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} userName={firstName} />
      <Toaster richColors position="top-right" />
    </div>
  )
}

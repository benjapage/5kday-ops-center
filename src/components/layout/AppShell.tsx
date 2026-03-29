import { useState, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { WelcomeScreen } from './WelcomeScreen'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { Toaster } from '@/components/ui/sonner'
import { useAuth } from '@/contexts/AuthContext'

const WELCOME_KEY = '5kday-welcome-shown'

export function AppShell() {
  const { profile, user } = useAuth()

  const welcomeDisabled = localStorage.getItem('5kday-welcome-disabled') === 'true'
  const alreadyShown = sessionStorage.getItem(WELCOME_KEY) === 'true'

  const [showWelcome, setShowWelcome] = useState(!welcomeDisabled && !alreadyShown)
  const [chatOpen, setChatOpen] = useState(false)

  const handleWelcomeComplete = useCallback(() => {
    sessionStorage.setItem(WELCOME_KEY, 'true')
    setShowWelcome(false)
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

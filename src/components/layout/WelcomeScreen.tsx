import { useState, useEffect } from 'react'

function getGreeting() {
  const h = new Date().getHours()
  if (h >= 6 && h < 12) return 'Buenos días'
  if (h >= 12 && h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

interface WelcomeScreenProps {
  name: string
  onComplete: () => void
}

export function WelcomeScreen({ name, onComplete }: WelcomeScreenProps) {
  const [phase, setPhase] = useState<'logo' | 'greeting' | 'typing' | 'fadeout' | 'done'>('logo')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('greeting'), 500)
    const t2 = setTimeout(() => setPhase('typing'), 1200)
    const t3 = setTimeout(() => setPhase('fadeout'), 3000)
    const t4 = setTimeout(() => {
      setPhase('done')
      onComplete()
    }, 3500)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [onComplete])

  if (phase === 'done') return null

  const motto = 'Vamos por los $5K \u{1F680}'

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500 ${
        phase === 'fadeout' ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ background: '#0B1A2E' }}
    >
      {/* Subtle animated gradient overlay */}
      <div className="welcome-gradient" />

      {/* Logo */}
      <div
        className={`relative transition-all duration-700 ${
          phase === 'logo' || phase === 'greeting' || phase === 'typing' || phase === 'fadeout'
            ? 'opacity-100 scale-100'
            : 'opacity-0 scale-90'
        }`}
      >
        <span className="welcome-logo select-none" style={{ fontSize: '4rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          <span style={{ color: '#FFFFFF' }}>5K</span>
          <span style={{ color: '#10B981' }}>day</span>
        </span>
        <div className="welcome-glow" />
      </div>

      {/* Greeting */}
      <p
        className={`mt-8 text-white font-semibold transition-all duration-700 ${
          phase === 'greeting' || phase === 'typing' || phase === 'fadeout'
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4'
        }`}
        style={{ fontSize: 'clamp(1.5rem, 5vw, 2.5rem)' }}
      >
        {getGreeting()}, {name}
      </p>

      {/* Typing motto */}
      <p
        className={`mt-3 font-medium transition-all duration-500 ${
          phase === 'typing' || phase === 'fadeout'
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4'
        }`}
        style={{ color: '#10B981', fontSize: 'clamp(1rem, 3vw, 1.25rem)' }}
      >
        <span className="welcome-typing">{motto}</span>
      </p>

      <style>{`
        .welcome-glow {
          position: absolute;
          inset: -20px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(16,185,129,0.25) 0%, transparent 70%);
          animation: welcome-pulse 2s ease-in-out infinite;
          pointer-events: none;
          z-index: -1;
        }

        .welcome-gradient {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 50% 40%, rgba(16,185,129,0.06) 0%, transparent 60%);
          pointer-events: none;
        }

        .welcome-typing {
          display: inline-block;
          border-right: 2px solid #10B981;
          animation: welcome-blink 0.6s step-end infinite;
          padding-right: 4px;
        }

        @keyframes welcome-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }

        @keyframes welcome-blink {
          0%, 100% { border-color: #10B981; }
          50% { border-color: transparent; }
        }
      `}</style>
    </div>
  )
}

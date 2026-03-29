import { useState, useEffect, useCallback } from 'react'

interface BanCheckDetail {
  phone: string
  name: string
  mcStatus: string
  wasStatus: string
  action: string
  consecutiveFailures?: number
}

interface BanCheckResult {
  checked: number
  banned: number
  restored: number
  flagged: number
  errors: { phone: string; error: string }[]
  details: BanCheckDetail[]
}

const COOLDOWN_KEY = '5kday-ban-check-last'
const COOLDOWN_MS = 30 * 60 * 1000 // 30 minutes

export function useWaBanCheck() {
  const [result, setResult] = useState<BanCheckResult | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [lastCheck, setLastCheck] = useState<string | null>(null)

  const runCheck = useCallback(async (force = false) => {
    if (isChecking) return

    // Cooldown unless forced
    if (!force) {
      const last = sessionStorage.getItem(COOLDOWN_KEY)
      if (last && Date.now() - Number(last) < COOLDOWN_MS) return
    }

    setIsChecking(true)
    try {
      const res = await fetch('/api/manychat-check')
      if (res.ok) {
        const data = await res.json()
        setResult(data)
        setLastCheck(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }))
        sessionStorage.setItem(COOLDOWN_KEY, String(Date.now()))
      }
    } catch {
      // Silently fail — don't block the UI
    } finally {
      setIsChecking(false)
    }
  }, [isChecking])

  // Auto-check on mount (with cooldown)
  useEffect(() => { runCheck(false) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const flaggedNumbers = result?.details?.filter(d => d.action === 'FLAGGED') ?? []

  return { result, isChecking, lastCheck, runCheck, flaggedNumbers }
}

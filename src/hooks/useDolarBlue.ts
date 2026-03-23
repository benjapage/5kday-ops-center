import { useEffect, useState } from 'react'

interface DolarBlue {
  venta: number
  compra: number | null
  timestamp: string
}

let globalCache: DolarBlue | null = null

export function useDolarBlue() {
  const [rate, setRate] = useState<DolarBlue | null>(globalCache)
  const [isLoading, setIsLoading] = useState(!globalCache)

  useEffect(() => {
    if (globalCache) return

    async function fetchRate() {
      try {
        const res = await fetch('/api/dolar-blue')
        if (!res.ok) throw new Error('Failed to fetch')
        const data: DolarBlue = await res.json()
        globalCache = data
        setRate(data)
      } catch {
        // Fallback hardcoded rate if API fails
        const fallback: DolarBlue = { venta: 1300, compra: 1250, timestamp: new Date().toISOString() }
        setRate(fallback)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRate()
  }, [])

  function toUSD(amountARS: number): number {
    const ventaRate = rate?.venta || 1300
    return amountARS / ventaRate
  }

  return { rate, isLoading, toUSD }
}

// Standalone helper for use outside React
export function convertArsToUsd(amountARS: number, blueVenta: number): number {
  return amountARS / blueVenta
}

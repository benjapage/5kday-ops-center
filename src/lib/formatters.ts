export function formatCurrency(amount: number, currency: 'USD' | 'ARS' = 'USD'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-AR').format(value)
}

export function formatROAS(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${value.toFixed(2)}×`
}

export function formatPercentage(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function formatDate(date: string | Date | null | undefined): string {
  if (date == null) return '—'
  // If it's already a full ISO timestamp, use it directly; otherwise append time to treat as local date
  const d = typeof date === 'string'
    ? (date.includes('T') || date.includes('Z') ? new Date(date) : new Date(date + 'T00:00:00'))
    : date
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes}m`
  if (hours < 24) return `hace ${hours}h`
  if (days < 7) return `hace ${days}d`
  return formatDate(d)
}

export function getDaysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return 0
  const start = dateStr.includes('T') || dateStr.includes('Z')
    ? new Date(dateStr)
    : new Date(dateStr + 'T00:00:00')
  if (isNaN(start.getTime())) return 0
  const now = new Date()
  const diff = now.getTime() - start.getTime()
  return Math.floor(diff / 86400000)
}

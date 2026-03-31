import { STATUS_COLORS } from '@/lib/constants'

type Status = 'cold' | 'warming' | 'ready' | 'active' | 'banned' | 'restricted' | 'review' | 'replaced'

const LABELS: Record<Status, string> = {
  cold: 'Frío',
  warming: 'Calentando',
  ready: 'Listo',
  active: 'Activo',
  banned: 'Baneado',
  restricted: 'Restringido',
  review: 'En revisión',
  replaced: 'Reemplazado',
}

interface StatusIndicatorProps {
  status: Status
  showLabel?: boolean
  size?: 'sm' | 'md'
}

export function StatusIndicator({ status, showLabel = true, size = 'sm' }: StatusIndicatorProps) {
  const dotSize = size === 'md' ? 'h-3 w-3' : 'h-2.5 w-2.5'

  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`${dotSize} rounded-full flex-shrink-0 ${status === 'warming' ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: STATUS_COLORS[status] || '#94A3B8' }}
      />
      {showLabel && (
        <span className="text-xs font-medium" style={{ color: STATUS_COLORS[status] || '#94A3B8' }}>
          {LABELS[status] || status}
        </span>
      )}
    </span>
  )
}

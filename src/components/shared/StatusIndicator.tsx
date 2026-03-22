import { STATUS_COLORS } from '@/lib/constants'

type Status = 'active' | 'warming' | 'banned'

const LABELS: Record<Status, string> = {
  active: 'Activo',
  warming: 'Calentando',
  banned: 'Baneado',
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
        style={{ backgroundColor: STATUS_COLORS[status] }}
      />
      {showLabel && (
        <span className="text-xs font-medium" style={{ color: STATUS_COLORS[status] }}>
          {LABELS[status]}
        </span>
      )}
    </span>
  )
}

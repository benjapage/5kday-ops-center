import { Progress } from '@/components/ui/progress'
import { getDaysSince } from '@/lib/formatters'
import { WA_WARMING_DAYS } from '@/lib/constants'

interface WarmingProgressProps {
  startDate: string
  status: 'cold' | 'warming' | 'ready' | 'banned'
}

export function WarmingProgress({ startDate, status }: WarmingProgressProps) {
  if (status === 'cold') {
    return <span className="text-xs text-slate-400">Sin iniciar</span>
  }

  if (status === 'ready') {
    return (
      <div className="flex items-center gap-2 min-w-[120px]">
        <Progress value={100} className="h-1.5 flex-1" />
        <span className="text-xs text-green-600 font-medium whitespace-nowrap">Listo</span>
      </div>
    )
  }

  if (status === 'banned') {
    return <span className="text-xs text-slate-400">—</span>
  }

  const days = getDaysSince(startDate)
  const progress = Math.min((days / WA_WARMING_DAYS) * 100, 100)
  const isReady = days >= WA_WARMING_DAYS

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <Progress value={progress} className="h-1.5 flex-1" />
      <span
        className={`text-xs font-medium whitespace-nowrap font-mono ${isReady ? 'text-green-600' : 'text-amber-600'}`}
      >
        {isReady ? 'Listo' : `${Math.min(days, WA_WARMING_DAYS)}/${WA_WARMING_DAYS}d`}
      </span>
    </div>
  )
}

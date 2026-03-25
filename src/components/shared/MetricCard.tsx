import { Card, CardContent } from '@/components/ui/card'
import type { LucideIcon } from 'lucide-react'
import { formatCurrency, formatROAS, formatNumber } from '@/lib/formatters'

interface MetricCardProps {
  title: string
  value: number | null | undefined
  format?: 'currency' | 'number' | 'roas'
  currency?: 'USD' | 'ARS'
  delta?: number
  icon: LucideIcon
  iconColor?: string
  subtitle?: string
}

export function MetricCard({
  title,
  value,
  format = 'currency',
  currency = 'USD',
  delta,
  icon: Icon,
  iconColor = '#10B981',
  subtitle,
}: MetricCardProps) {
  function formatValue(val: number | null | undefined): string {
    if (val == null) return '—'
    if (format === 'currency') return formatCurrency(val, currency)
    if (format === 'roas') return formatROAS(val)
    return formatNumber(val)
  }

  return (
    <Card className="shadow-sm border border-slate-200/80 dark:border-slate-700/60 dark:bg-slate-800/60 hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight font-mono tabular-nums text-slate-800 dark:text-slate-100">
              {formatValue(value)}
            </p>
            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
            )}
            {delta !== undefined && (
              <span
                className={`mt-1 inline-block text-xs font-medium ${
                  delta >= 0 ? 'text-green-600' : 'text-red-500'
                }`}
              >
                {delta >= 0 ? '+' : ''}{delta.toFixed(1)}% vs mes anterior
              </span>
            )}
          </div>
          <div
            className="rounded-xl p-2.5 flex-shrink-0"
            style={{ backgroundColor: `${iconColor}12` }}
          >
            <Icon size={18} style={{ color: iconColor }} strokeWidth={2} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

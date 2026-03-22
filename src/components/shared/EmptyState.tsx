import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="mb-4 rounded-full bg-slate-100 p-4">
          <Icon size={28} className="text-slate-400" />
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-700">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-slate-500 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

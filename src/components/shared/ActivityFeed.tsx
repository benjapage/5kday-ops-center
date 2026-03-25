import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatRelativeTime } from '@/lib/formatters'
import { LoadingSpinner } from './LoadingSpinner'
import { Activity } from 'lucide-react'

interface ActivityEntry {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  created_at: string
  profiles: { full_name: string; role: string } | null
}

const ACTION_LABELS: Record<string, string> = {
  'wa_account.created': 'agrego una cuenta WA',
  'wa_account.updated': 'actualizo una cuenta WA',
  'wa_account.deleted': 'elimino una cuenta WA',
  'wa_account.status_changed': 'cambio el estado de una cuenta WA',
  'expense.created': 'registro un gasto',
  'revenue.created': 'registro un ingreso',
  'offer.created': 'creo una oferta',
  'offer.updated': 'actualizo una oferta',
  'offer.archived': 'archivo una oferta',
  'creative.created': 'subio un creativo',
  'creative.retired': 'retiro un creativo',
  'team.role_changed': 'cambio un rol de equipo',
  'checklist.item_completed': 'completo un item de checklist',
  'drive_link.created': 'agrego un link al drive',
}

interface ActivityFeedProps {
  limit?: number
}

export function ActivityFeed({ limit = 10 }: ActivityFeedProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchEntries() {
      const { data, error } = await supabase
        .from('activity_log')
        .select('*, profiles(full_name, role)')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (!error) setEntries((data as ActivityEntry[]) ?? [])
      setIsLoading(false)
    }
    fetchEntries()
  }, [limit])

  if (isLoading) return <LoadingSpinner />

  if (entries.length === 0) {
    return (
      <p className="text-sm text-slate-400 text-center py-6">Sin actividad reciente</p>
    )
  }

  return (
    <ul className="space-y-3">
      {entries.map(entry => (
        <li key={entry.id} className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 p-1.5 flex-shrink-0">
            <Activity size={12} style={{ color: '#10B981' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              <span className="font-medium">{entry.profiles?.full_name ?? 'Sistema'}</span>
              {' '}{ACTION_LABELS[entry.action] ?? entry.action}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {formatRelativeTime(entry.created_at)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}

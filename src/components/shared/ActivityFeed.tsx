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
  'wa_account.created': 'agregó una cuenta WA',
  'wa_account.updated': 'actualizó una cuenta WA',
  'wa_account.deleted': 'eliminó una cuenta WA',
  'wa_account.status_changed': 'cambió el estado de una cuenta WA',
  'expense.created': 'registró un gasto',
  'revenue.created': 'registró un ingreso',
  'offer.created': 'creó una oferta',
  'offer.updated': 'actualizó una oferta',
  'offer.archived': 'archivó una oferta',
  'creative.created': 'subió un creativo',
  'creative.retired': 'retiró un creativo',
  'team.role_changed': 'cambió un rol de equipo',
  'checklist.item_completed': 'completó un ítem de checklist',
  'drive_link.created': 'agregó un link al drive',
}

interface ActivityFeedProps {
  limit?: number
}

export function ActivityFeed({ limit = 10 }: ActivityFeedProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('activity_log')
        .select('*, profiles(full_name, role)')
        .order('created_at', { ascending: false })
        .limit(limit)

      setEntries((data as ActivityEntry[]) ?? [])
      setIsLoading(false)
    }
    fetch()
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
          <div className="mt-0.5 rounded-full bg-emerald-50 p-1.5 flex-shrink-0">
            <Activity size={12} style={{ color: '#10B981' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-700">
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

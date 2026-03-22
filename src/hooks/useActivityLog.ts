import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export function useActivityLog() {
  const { profile } = useAuth()

  async function logAction(
    action: string,
    entityType: string,
    entityId?: string,
    metadata?: Record<string, unknown>
  ) {
    if (!profile) return

    try {
      await supabase.from('activity_log').insert({
        user_id: profile.id,
        action,
        entity_type: entityType,
        entity_id: entityId ?? null,
        metadata: metadata ?? null,
      })
    } catch {
      // Activity logging is non-critical — fail silently
    }
  }

  return { logAction }
}

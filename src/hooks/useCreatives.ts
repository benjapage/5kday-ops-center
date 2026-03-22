import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useActivityLog } from './useActivityLog'
import { useAuth } from '@/contexts/AuthContext'
import type { Database } from '@/types/database.types'

type Creative = Database['public']['Tables']['creatives']['Row']
type CreativeInsert = Database['public']['Tables']['creatives']['Insert']

export function useCreatives() {
  const [creatives, setCreatives] = useState<Creative[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { logAction } = useActivityLog()
  const { profile } = useAuth()

  async function fetchAll() {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('creatives')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setCreatives(data ?? [])
    setIsLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  async function create(data: Omit<CreativeInsert, 'created_by'>): Promise<{ error: string | null }> {
    const { data: inserted, error } = await supabase
      .from('creatives')
      .insert({ ...data, created_by: profile?.id ?? null })
      .select()
      .single()

    if (error) return { error: error.message }
    await logAction('creative.created', 'creative', inserted.id, { name: data.name })
    await fetchAll()
    return { error: null }
  }

  async function retire(id: string): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('creatives')
      .update({ status: 'retired', updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return { error: error.message }
    await logAction('creative.retired', 'creative', id)
    await fetchAll()
    return { error: null }
  }

  return { creatives, isLoading, create, retire, refresh: fetchAll }
}

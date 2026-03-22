import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useActivityLog } from './useActivityLog'
import { useAuth } from '@/contexts/AuthContext'
import type { Database } from '@/types/database.types'

type Offer = Database['public']['Tables']['offers']['Row']
type OfferInsert = Database['public']['Tables']['offers']['Insert']
type OfferUpdate = Database['public']['Tables']['offers']['Update']

export function useOffers() {
  const [offers, setOffers] = useState<Offer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { logAction } = useActivityLog()
  const { profile } = useAuth()

  async function fetchAll() {
    setIsLoading(true)
    const { data } = await supabase
      .from('offers')
      .select('*')
      .order('status')
      .order('start_date', { ascending: false })
    setOffers(data ?? [])
    setIsLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  async function create(data: Omit<OfferInsert, 'created_by'>): Promise<{ error: string | null }> {
    const { data: inserted, error } = await supabase
      .from('offers')
      .insert({ ...data, created_by: profile?.id ?? null })
      .select()
      .single()

    if (error) return { error: error.message }
    await logAction('offer.created', 'offer', inserted.id, { name: data.name })
    await fetchAll()
    return { error: null }
  }

  async function update(id: string, data: OfferUpdate): Promise<{ error: string | null }> {
    const before = offers.find(o => o.id === id)
    const { error } = await supabase
      .from('offers')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return { error: error.message }
    await logAction('offer.updated', 'offer', id, { before, after: data })
    await fetchAll()
    return { error: null }
  }

  async function archive(id: string): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('offers')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return { error: error.message }
    await logAction('offer.archived', 'offer', id)
    await fetchAll()
    return { error: null }
  }

  return { offers, isLoading, create, update, archive, refresh: fetchAll }
}

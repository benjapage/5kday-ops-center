import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

export interface Subscription {
  id: string
  name: string
  amount: number
  currency: 'USD' | 'ARS'
  category: string
  billing_day: number
  is_active: boolean
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

interface SubscriptionInsert {
  name: string
  amount: number
  currency: 'USD' | 'ARS'
  category: string
  billing_day: number
  notes?: string
}

export function useSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { profile } = useAuth()

  const fetchAll = useCallback(async () => {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .order('name')

    if (!error && data) setSubscriptions(data as Subscription[])
    setIsLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function create(data: SubscriptionInsert): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('subscriptions')
      .insert({ ...data, created_by: profile?.id ?? null })

    if (error) return { error: error.message }
    await fetchAll()
    return { error: null }
  }

  async function toggleActive(id: string, isActive: boolean): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('subscriptions')
      .update({ is_active: !isActive, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return { error: error.message }
    await fetchAll()
    return { error: null }
  }

  async function remove(id: string): Promise<{ error: string | null }> {
    const { error } = await supabase.from('subscriptions').delete().eq('id', id)
    if (error) return { error: error.message }
    await fetchAll()
    return { error: null }
  }

  async function processSubscriptions(): Promise<void> {
    const { data, error } = await supabase.rpc('process_subscriptions')
    if (error) {
      toast.error('Error procesando suscripciones: ' + error.message)
      return
    }
    const count = data as number
    if (count > 0) {
      toast.success(`${count} gasto${count > 1 ? 's' : ''} de suscripcion creado${count > 1 ? 's' : ''}`)
    } else {
      toast.info('Todas las suscripciones del mes ya estan registradas')
    }
  }

  return { subscriptions, isLoading, create, toggleActive, remove, processSubscriptions, refresh: fetchAll }
}

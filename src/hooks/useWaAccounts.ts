import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useActivityLog } from './useActivityLog'
import { useAuth } from '@/contexts/AuthContext'
import { WA_WARMING_DAYS } from '@/lib/constants'
import type { Database } from '@/types/database.types'

type WaAccount = Database['public']['Tables']['wa_accounts']['Row']
type WaInsert = Database['public']['Tables']['wa_accounts']['Insert']
type WaUpdate = Database['public']['Tables']['wa_accounts']['Update']

export function useWaAccounts() {
  const [accounts, setAccounts] = useState<WaAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { logAction } = useActivityLog()
  const { profile } = useAuth()

  async function fetchAll() {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('wa_accounts')
      .select('*')
      .order('status')
      .order('start_date', { ascending: false })

    if (!error) setAccounts(data ?? [])
    setIsLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  async function create(data: Omit<WaInsert, 'created_by'>): Promise<{ error: string | null }> {
    const { data: inserted, error } = await supabase
      .from('wa_accounts')
      .insert({ ...data, created_by: profile?.id ?? null })
      .select()
      .single()

    if (error) return { error: error.message }

    await logAction('wa_account.created', 'wa_account', inserted.id, { phone: data.phone_number })
    await fetchAll()
    return { error: null }
  }

  async function update(id: string, data: WaUpdate): Promise<{ error: string | null }> {
    const before = accounts.find(a => a.id === id)
    const { error } = await supabase
      .from('wa_accounts')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return { error: error.message }

    await logAction('wa_account.updated', 'wa_account', id, { before, after: data })
    await fetchAll()
    return { error: null }
  }

  async function setStatus(
    id: string,
    status: 'cold' | 'warming' | 'ready' | 'banned'
  ): Promise<{ error: string | null }> {
    const account = accounts.find(a => a.id === id)
    if (!account) return { error: 'Cuenta no encontrada' }

    // Guard de 7 días para marcar listo
    if (status === 'ready') {
      const startDate = new Date(account.start_date + 'T00:00:00')
      const readyDate = new Date(startDate.getTime() + WA_WARMING_DAYS * 86400000)
      if (new Date() < readyDate) {
        const daysLeft = Math.ceil((readyDate.getTime() - Date.now()) / 86400000)
        return { error: `Este número necesita ${daysLeft} día(s) más de calentamiento` }
      }
    }

    const { error } = await supabase
      .from('wa_accounts')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return { error: error.message }

    await logAction('wa_account.status_changed', 'wa_account', id, {
      from: account.status,
      to: status,
    })
    await fetchAll()
    return { error: null }
  }

  async function remove(id: string): Promise<{ error: string | null }> {
    const account = accounts.find(a => a.id === id)
    const { error } = await supabase.from('wa_accounts').delete().eq('id', id)
    if (error) return { error: error.message }

    await logAction('wa_account.deleted', 'wa_account', id, { phone: account?.phone_number })
    await fetchAll()
    return { error: null }
  }

  return { accounts, isLoading, create, update, setStatus, remove, refresh: fetchAll }
}

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
  const [priorityIds, setPriorityIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const { logAction } = useActivityLog()
  const { profile } = useAuth()

  async function fetchAll() {
    setIsLoading(true)
    const [{ data, error }, { data: settings }] = await Promise.all([
      supabase.from('wa_accounts').select('*').order('status').order('start_date', { ascending: false }),
      supabase.from('settings').select('value').eq('id', 'wa_priority_numbers').single(),
    ])
    if (!error) setAccounts(data ?? [])
    setPriorityIds(new Set((settings?.value as string[]) || []))
    setIsLoading(false)
  }

  function isPriority(id: string) { return priorityIds.has(id) }

  async function togglePriority(id: string) {
    const next = new Set(priorityIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    setPriorityIds(next)
    await supabase.from('settings').upsert({
      id: 'wa_priority_numbers',
      value: [...next],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
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

  async function reportBan(id: string): Promise<{ error: string | null }> {
    const account = accounts.find(a => a.id === id)
    if (!account) return { error: 'Cuenta no encontrada' }
    if (account.status === 'banned') return { error: 'Ya está marcada como baneada' }

    // 1. Update status
    const { error } = await supabase
      .from('wa_accounts')
      .update({ status: 'banned', updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }

    // 2. Log ban event
    await supabase.from('meta_ban_events').insert({
      wa_account_id: id,
      phone_number: account.phone_number,
      source: 'manual',
      quality_score: 'reported',
      details: { source: 'manual_report', previous_status: account.status },
    })

    // 3. Create urgent task
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('app_tasks').insert({
      title: `URGENTE: Numero ${account.phone_number} baneado — reemplazar`,
      scheduled_date: today,
      scheduled_time: '08:00',
      source: 'system_wa_ban',
      is_urgent: true,
      related_number_id: id,
    })

    await logAction('wa_account.ban_reported', 'wa_account', id, {
      phone: account.phone_number,
      previous_status: account.status,
    })
    await fetchAll()
    return { error: null }
  }

  async function restoreFromBan(id: string): Promise<{ error: string | null }> {
    const account = accounts.find(a => a.id === id)
    if (!account) return { error: 'Cuenta no encontrada' }

    // Update status back to ready
    const { error } = await supabase
      .from('wa_accounts')
      .update({ status: 'ready', updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }

    // Clear ban events for this account so cron counter resets
    await supabase.from('meta_ban_events').delete().eq('wa_account_id', id)

    await logAction('wa_account.restored', 'wa_account', id, {
      phone: account.phone_number,
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

  return { accounts, isLoading, priorityIds, isPriority, togglePriority, create, update, setStatus, reportBan, restoreFromBan, remove, refresh: fetchAll }
}

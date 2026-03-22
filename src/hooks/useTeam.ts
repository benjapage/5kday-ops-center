import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useActivityLog } from './useActivityLog'
import { useAuth } from '@/contexts/AuthContext'
import type { Database } from '@/types/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']
type Checklist = Database['public']['Tables']['team_checklists']['Row']
type ChecklistItem = Database['public']['Tables']['checklist_items']['Row']
type DriveLink = Database['public']['Tables']['drive_links']['Row']

interface ChecklistWithItems extends Checklist {
  items: (ChecklistItem & { completedToday: boolean })[]
}

export function useTeam() {
  const [members, setMembers] = useState<Profile[]>([])
  const [checklists, setChecklists] = useState<ChecklistWithItems[]>([])
  const [driveLinks, setDriveLinks] = useState<DriveLink[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { logAction } = useActivityLog()
  const { profile } = useAuth()

  async function fetchAll() {
    setIsLoading(true)
    const today = new Date().toISOString().split('T')[0]

    const [membersRes, checklistsRes, itemsRes, completionsRes, driveRes] = await Promise.all([
      supabase.from('profiles').select('*').order('role').order('full_name'),
      supabase.from('team_checklists').select('*').order('created_at'),
      supabase.from('checklist_items').select('*').order('position'),
      supabase
        .from('checklist_completions')
        .select('*')
        .gte('completed_at', today + 'T00:00:00'),
      supabase.from('drive_links').select('*').order('category').order('title'),
    ])

    const completedItemIds = new Set(
      (completionsRes.data ?? [])
        .filter(c => c.completed_by === profile?.id)
        .map(c => c.item_id)
    )

    const checklistsWithItems = (checklistsRes.data ?? []).map(cl => ({
      ...cl,
      items: (itemsRes.data ?? [])
        .filter(item => item.checklist_id === cl.id)
        .map(item => ({ ...item, completedToday: completedItemIds.has(item.id) })),
    }))

    if (!membersRes.error) setMembers(membersRes.data ?? [])
    setChecklists(checklistsWithItems)
    if (!driveRes.error) setDriveLinks(driveRes.data ?? [])
    setIsLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  async function updateRole(id: string, role: Profile['role']): Promise<{ error: string | null }> {
    const before = members.find(m => m.id === id)
    const { error } = await supabase.from('profiles').update({ role, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) return { error: error.message }
    await logAction('team.role_changed', 'profile', id, { from: before?.role, to: role })
    await fetchAll()
    return { error: null }
  }

  async function toggleChecklistItem(itemId: string, currentlyCompleted: boolean): Promise<void> {
    if (!profile) return
    const today = new Date().toISOString().split('T')[0]
    if (currentlyCompleted) {
      await supabase
        .from('checklist_completions')
        .delete()
        .eq('item_id', itemId)
        .eq('completed_by', profile.id)
        .gte('completed_at', today + 'T00:00:00')
    } else {
      await supabase
        .from('checklist_completions')
        .insert({ item_id: itemId, completed_by: profile.id })
      await logAction('checklist.item_completed', 'checklist_item', itemId)
    }
    await fetchAll()
  }

  async function addDriveLink(data: { title: string; url: string; category?: string }): Promise<{ error: string | null }> {
    const { data: inserted, error } = await supabase
      .from('drive_links')
      .insert({ ...data, created_by: profile?.id ?? null })
      .select()
      .single()
    if (error) return { error: error.message }
    await logAction('drive_link.created', 'drive_link', inserted.id, { title: data.title })
    await fetchAll()
    return { error: null }
  }

  async function deleteDriveLink(id: string): Promise<{ error: string | null }> {
    const { error } = await supabase.from('drive_links').delete().eq('id', id)
    if (error) return { error: error.message }
    await fetchAll()
    return { error: null }
  }

  async function addChecklist(title: string, role: string, items: string[]): Promise<{ error: string | null }> {
    const { data: cl, error: clErr } = await supabase
      .from('team_checklists')
      .insert({ title, assigned_role: role as Checklist['assigned_role'], created_by: profile?.id ?? null })
      .select()
      .single()
    if (clErr) return { error: clErr.message }

    if (items.length > 0) {
      await supabase.from('checklist_items').insert(
        items.map((label, i) => ({ checklist_id: cl.id, label, position: i }))
      )
    }
    await fetchAll()
    return { error: null }
  }

  return {
    members, checklists, driveLinks, isLoading,
    updateRole, toggleChecklistItem, addDriveLink, deleteDriveLink, addChecklist,
    refresh: fetchAll,
  }
}

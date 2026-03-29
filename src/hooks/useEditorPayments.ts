import { useState, useEffect, useCallback } from 'react'

export interface Editor {
  id: string
  name: string
  rate_per_video_cents: number
  rate_per_winner_cents: number
  winner_threshold_cents: number
  active: boolean
}

export interface WinnerAd {
  ad_name: string
  ad_id?: string
  spend_cents: number
  revenue_cents?: number
}

export interface EditorPayment {
  editor_id: string
  week_start: string
  week_end: string
  videos_count: number
  fixed_pay_cents: number
  winners: WinnerAd[]
  winners_count: number
  variable_pay_cents: number
  total_pay_cents: number
  paid: boolean
  paid_at: string | null
}

export interface EditorWithPayment {
  editor: Editor
  payment: EditorPayment | null
}

export interface WeekData {
  start: string
  end: string
}

function getLastMonday(date?: Date): string {
  const d = date ? new Date(date) : new Date()
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  return d.toISOString().split('T')[0]
}

export function useEditorPayments() {
  const [editors, setEditors] = useState<EditorWithPayment[]>([])
  const [week, setWeek] = useState<WeekData | null>(null)
  const [saved, setSaved] = useState(false)
  const [unmatchedWinners, setUnmatchedWinners] = useState<WinnerAd[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [weekStart, setWeekStart] = useState(getLastMonday())

  const fetchWeek = useCallback(async (ws: string) => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/drive-offer-sync?action=ep-calculate&week_start=${ws}`)
      if (res.ok) {
        const data = await res.json()
        setEditors(data.editors || [])
        setWeek(data.week || null)
        setSaved(data.saved || false)
        setUnmatchedWinners(data.unmatched_winners || [])
      }
    } catch {}
    setIsLoading(false)
  }, [])

  useEffect(() => { fetchWeek(weekStart) }, [weekStart, fetchWeek])

  function prevWeek() {
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    setWeekStart(d.toISOString().split('T')[0])
  }

  function nextWeek() {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    const next = d.toISOString().split('T')[0]
    if (next <= getLastMonday()) setWeekStart(next)
  }

  function thisWeek() {
    setWeekStart(getLastMonday())
  }

  async function savePayments() {
    const payments = editors
      .filter(e => e.payment)
      .map(e => e.payment!)
    const res = await fetch('/api/drive-offer-sync?action=ep-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payments }),
    })
    const data = await res.json()
    if (!data.error) {
      setSaved(true)
      await fetchWeek(weekStart)
    }
    return data
  }

  async function markPaid() {
    const res = await fetch('/api/drive-offer-sync?action=ep-mark-paid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ week_start: weekStart }),
    })
    const data = await res.json()
    if (!data.error) await fetchWeek(weekStart)
    return data
  }

  // Totals
  const totalVideos = editors.reduce((s, e) => s + (e.payment?.videos_count || 0), 0)
  const totalFixed = editors.reduce((s, e) => s + (e.payment?.fixed_pay_cents || 0), 0)
  const totalWinners = editors.reduce((s, e) => s + (e.payment?.winners_count || 0), 0)
  const totalVariable = editors.reduce((s, e) => s + (e.payment?.variable_pay_cents || 0), 0)
  const totalPay = editors.reduce((s, e) => s + (e.payment?.total_pay_cents || 0), 0)
  const allPaid = editors.length > 0 && editors.every(e => e.payment?.paid)

  return {
    editors, week, saved, unmatchedWinners, isLoading,
    weekStart, prevWeek, nextWeek, thisWeek,
    savePayments, markPaid, refresh: () => fetchWeek(weekStart),
    totals: { totalVideos, totalFixed, totalWinners, totalVariable, totalPay },
    allPaid,
  }
}

export function useEditorConfig() {
  const [editors, setEditors] = useState<Editor[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch('/api/drive-offer-sync?action=ep-editors')
      if (res.ok) {
        const data = await res.json()
        setEditors(data.editors || [])
      }
    } catch {}
    setIsLoading(false)
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  async function updateEditor(id: string, updates: Partial<Editor>) {
    const res = await fetch('/api/drive-offer-sync?action=ep-update-editor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    })
    const data = await res.json()
    if (!data.error) await fetch_()
    return data
  }

  async function addEditor(name: string) {
    const res = await fetch('/api/drive-offer-sync?action=ep-add-editor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    if (!data.error) await fetch_()
    return data
  }

  return { editors, isLoading, updateEditor, addEditor, refresh: fetch_ }
}

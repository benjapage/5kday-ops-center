import { useEffect, useState, useCallback } from 'react'

export interface CalendarTask {
  id: string
  title: string
  time: string
  date: string
  completed: boolean
  source: string
  is_urgent?: boolean
  color?: string
  google_event_id?: string
}

export interface CalendarStatus {
  connected: boolean
  calendar?: string
  email?: string
}

function getWeekDates(offset = 0): string[] {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

export function useCalendarTasks(date?: string) {
  const [tasks, setTasks] = useState<CalendarTask[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [calendarConnected, setCalendarConnected] = useState(false)

  const targetDate = date || new Date().toISOString().split('T')[0]

  const fetchTasks = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/calendar?action=events&date=${targetDate}`)
      if (res.ok) {
        const data = await res.json()
        setTasks((data.tasks || []).map((t: any) => ({ ...t, date: targetDate })))
        setCalendarConnected(data.calendarConnected)
      }
    } catch {}
    setIsLoading(false)
  }, [targetDate])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  async function toggleComplete(taskId: string, completed: boolean) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed } : t))
    const res = await fetch('/api/calendar?action=complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, completed }),
    })
    if (!res.ok) setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !completed } : t))
    return { error: res.ok ? null : 'Failed' }
  }

  async function createTask(title: string, time?: string) {
    const res = await fetch('/api/calendar?action=create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, date: targetDate, time, source: 'manual' }),
    })
    const data = await res.json()
    if (!data.error) await fetchTasks()
    return { error: data.error || null, googleEventCreated: data.googleEventCreated }
  }

  async function deleteTask(taskId: string) {
    setTasks(prev => prev.filter(t => t.id !== taskId))
    const res = await fetch('/api/calendar?action=delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId }),
    })
    if (!res.ok) await fetchTasks() // revert on failure
    return { error: res.ok ? null : 'Failed' }
  }

  return { tasks, isLoading, calendarConnected, refresh: fetchTasks, toggleComplete, createTask, deleteTask }
}

export function useWeeklyCalendar(weekOffset = 0) {
  const [tasksByDate, setTasksByDate] = useState<Record<string, CalendarTask[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [calendarConnected, setCalendarConnected] = useState(false)
  const [offset, setOffset] = useState(weekOffset)

  const weekDates = getWeekDates(offset)

  const fetchWeek = useCallback(async () => {
    setIsLoading(true)
    const results: Record<string, CalendarTask[]> = {}
    let connected = false

    // Fetch all 7 days in parallel
    const promises = weekDates.map(async (date) => {
      try {
        const res = await fetch(`/api/calendar?action=events&date=${date}`)
        if (res.ok) {
          const data = await res.json()
          connected = connected || data.calendarConnected
          results[date] = (data.tasks || []).map((t: any) => ({ ...t, date }))
        } else {
          results[date] = []
        }
      } catch {
        results[date] = []
      }
    })

    await Promise.all(promises)
    setTasksByDate(results)
    setCalendarConnected(connected)
    setIsLoading(false)
  }, [weekDates.join(',')])

  useEffect(() => { fetchWeek() }, [fetchWeek])

  async function toggleComplete(taskId: string, completed: boolean) {
    // Optimistic update across all dates
    setTasksByDate(prev => {
      const next = { ...prev }
      for (const date of Object.keys(next)) {
        next[date] = next[date].map(t => t.id === taskId ? { ...t, completed } : t)
      }
      return next
    })
    await fetch('/api/calendar?action=complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, completed }),
    })
  }

  async function createTask(title: string, date: string, time?: string) {
    const res = await fetch('/api/calendar?action=create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, date, time, source: 'manual' }),
    })
    const data = await res.json()
    if (!data.error) await fetchWeek()
    return { error: data.error || null }
  }

  async function deleteTask(taskId: string) {
    setTasksByDate(prev => {
      const next = { ...prev }
      for (const date of Object.keys(next)) {
        next[date] = next[date].filter(t => t.id !== taskId)
      }
      return next
    })
    const res = await fetch('/api/calendar?action=delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId }),
    })
    if (!res.ok) await fetchWeek()
  }

  return {
    weekDates,
    tasksByDate,
    isLoading,
    calendarConnected,
    offset,
    prevWeek: () => setOffset(o => o - 1),
    nextWeek: () => setOffset(o => o + 1),
    thisWeek: () => setOffset(0),
    refresh: fetchWeek,
    toggleComplete,
    createTask,
    deleteTask,
  }
}

export function useCalendarStatus() {
  const [status, setStatus] = useState<CalendarStatus>({ connected: false })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/calendar?action=status')
      .then(r => r.ok ? r.json() : { connected: false })
      .then(setStatus)
      .finally(() => setIsLoading(false))
  }, [])

  return { status, isLoading }
}

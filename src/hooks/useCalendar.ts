import { useEffect, useState, useCallback } from 'react'

export interface CalendarTask {
  id: string
  title: string
  time: string
  completed: boolean
  source: string
  google_event_id?: string
}

export interface CalendarStatus {
  connected: boolean
  calendar?: string
  email?: string
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
        setTasks(data.tasks || [])
        setCalendarConnected(data.calendarConnected)
      }
    } catch {}
    setIsLoading(false)
  }, [targetDate])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  async function toggleComplete(taskId: string, completed: boolean) {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed } : t))

    const res = await fetch('/api/calendar?action=complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, completed }),
    })
    if (!res.ok) {
      // Revert
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !completed } : t))
      return { error: 'Failed to update task' }
    }
    return { error: null }
  }

  async function createTask(title: string, time?: string) {
    const res = await fetch('/api/calendar?action=create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, date: targetDate, time, source: 'manual' }),
    })
    const data = await res.json()
    if (data.error) return { error: data.error }
    await fetchTasks()
    return { error: null, googleEventCreated: data.googleEventCreated }
  }

  return { tasks, isLoading, calendarConnected, refresh: fetchTasks, toggleComplete, createTask }
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

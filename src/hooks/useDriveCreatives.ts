import { useState, useCallback } from 'react'

export interface DriveCreative {
  id: string
  creative_type: 'video' | 'imagen'
  testeo_folder_name: string
  testeo_number: number
  file_name: string
  file_type: string | null
  drive_file_id: string
  status: 'subido' | 'publicado'
  published_at: string | null
  uploaded_by: string | null
  detected_at: string
}

export interface TesteoGroup {
  testeo: string
  number: number
  files: DriveCreative[]
  subido: number
  publicado: number
}

export interface OfferDriveStatus {
  linked: boolean
  folder_id?: string
  drive_folder_id?: string
  last_sync?: string
  videos: TesteoGroup[]
  images: TesteoGroup[]
  today: { videos: number; images: number }
  totals: { videos: number; images: number; pendientes: number; publicados: number }
}

export interface DashboardCreativeSummary {
  offers: {
    offer_id: string
    offer_name: string
    today_videos: number
    today_images: number
    total_videos: number
    total_images: number
    pendientes: number
  }[]
  today: { videos: number; images: number }
  targets: { videos: number; images: number }
}

export function useDriveCreatives(offerId: string) {
  const [data, setData] = useState<OfferDriveStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const fetch_ = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/drive-offer-sync?action=status&offer_id=${offerId}`)
      if (res.ok) setData(await res.json())
    } catch {}
    setIsLoading(false)
  }, [offerId])

  async function linkFolder(driveUrl: string) {
    const res = await fetch('/api/drive-offer-sync?action=link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offer_id: offerId, drive_url: driveUrl }),
    })
    const result = await res.json()
    if (!result.error) await fetch_()
    return result
  }

  async function syncFolder() {
    setSyncing(true)
    try {
      const res = await fetch(`/api/drive-offer-sync?action=sync&offer_id=${offerId}`)
      const result = await res.json()
      if (!result.error) await fetch_()
      return result
    } finally {
      setSyncing(false)
    }
  }

  async function publishTesteo(offerFolderId: string, testeoNumber: number, creativeType: string) {
    const res = await fetch('/api/drive-offer-sync?action=publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offer_folder_id: offerFolderId, testeo_number: testeoNumber, creative_type: creativeType }),
    })
    const result = await res.json()
    if (!result.error) await fetch_()
    return result
  }

  return { data, isLoading, syncing, refresh: fetch_, linkFolder, syncFolder, publishTesteo }
}

export function useDashboardCreatives() {
  const [data, setData] = useState<DashboardCreativeSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch('/api/drive-offer-sync?action=dashboard-summary')
      if (res.ok) setData(await res.json())
    } catch {}
    setIsLoading(false)
  }, [])

  return { data, isLoading, refresh: fetch_ }
}

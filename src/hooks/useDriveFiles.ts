import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface DriveFile {
  id: string
  file_id: string
  file_name: string
  mime_type: string | null
  folder_id: string
  folder_type: 'anuncios' | 'ofertas'
  web_view_link: string | null
  ad_number: number | null
  test_number: number | null
  editor: string | null
  offer_name: string | null
  file_type: string | null
  offer_folder: string | null
  created_time: string | null
  modified_time: string | null
  detected_at: string
  processed: boolean
}

export interface GoogleToken {
  id: string
  email: string
  is_active: boolean
  connected_at: string
  token_expiry: string
}

export function useGoogleConnection() {
  const [connection, setConnection] = useState<GoogleToken | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    const { data } = await supabase
      .from('google_tokens')
      .select('id, email, is_active, connected_at, token_expiry')
      .eq('is_active', true)
      .order('connected_at', { ascending: false })
      .limit(1)
      .single()
    setConnection(data || null)
    setIsLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])
  return { connection, isLoading, refresh }
}

export function useDriveFiles(folderType?: 'anuncios' | 'ofertas') {
  const [files, setFiles] = useState<DriveFile[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    let query = supabase
      .from('drive_files')
      .select('*')
      .order('modified_time', { ascending: false })

    if (folderType) {
      query = query.eq('folder_type', folderType)
    }

    const { data } = await query
    setFiles((data as DriveFile[]) || [])
    setIsLoading(false)
  }, [folderType])

  useEffect(() => { refresh() }, [refresh])
  return { files, isLoading, refresh }
}

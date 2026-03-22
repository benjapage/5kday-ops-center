import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ShopifyStore {
  id: string
  shop: string
  custom_domain: string | null
  display_name: string | null
  slug: string
  scopes: string | null
  webhook_id: string | null
  is_active: boolean
  installed_at: string
  updated_at: string
}

export function useShopifyStores() {
  const [stores, setStores] = useState<ShopifyStore[]>([])
  const [isLoading, setIsLoading] = useState(true)

  async function fetchStores() {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('shopify_stores')
      .select('id, shop, custom_domain, display_name, slug, scopes, webhook_id, is_active, installed_at, updated_at')
      .order('installed_at', { ascending: false })
    if (!error) setStores(data ?? [])
    setIsLoading(false)
  }

  useEffect(() => { fetchStores() }, [])

  return { stores, isLoading, refresh: fetchStores }
}

import { useState, useEffect, useCallback } from 'react'
import { Video, ImageIcon, Target, RefreshCw, CheckCircle2, Clock, ChevronDown, ChevronRight, Palette, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { useOfferTesteos } from '@/hooks/useSettings'
import { toast } from 'sonner'

interface CreativeFile {
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

interface CreativeGroup {
  creative_type: string
  testeo: string
  testeo_number: number
  files: CreativeFile[]
  subido: number
  publicado: number
}

interface OfferCreatives {
  offer_id: string
  offer_folder_id: string
  offer_name: string
  last_sync: string | null
  groups: CreativeGroup[]
  totals: { videos: number; images: number; subido: number; publicado: number }
}

function useAllCreatives() {
  const [offers, setOffers] = useState<OfferCreatives[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const fetch_ = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/drive-offer-sync?action=weekly-creatives')
      if (res.ok) {
        const data = await res.json()
        setOffers(data.offers || [])
      }
    } catch {}
    setIsLoading(false)
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  async function syncAll() {
    setSyncing(true)
    try {
      await fetch('/api/drive-offer-sync?action=sync-all')
      await fetch_()
      toast.success('Sincronizado')
    } catch { toast.error('Error al sincronizar') }
    setSyncing(false)
  }

  async function publishGroup(offerFolderId: string, testeoNumber: number, creativeType: string) {
    const res = await fetch('/api/drive-offer-sync?action=publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offer_folder_id: offerFolderId, testeo_number: testeoNumber, creative_type: creativeType }),
    })
    if (res.ok) {
      toast.success('Marcado como publicado')
      await fetch_()
    }
  }

  async function deleteCreative(creativeId: string) {
    setOffers(prev => prev.map(o => ({
      ...o,
      groups: o.groups.map(g => ({ ...g, files: g.files.filter(f => f.id !== creativeId) })).filter(g => g.files.length > 0),
    })))
    const res = await fetch('/api/drive-offer-sync?action=delete-creative', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creative_id: creativeId }),
    })
    if (!res.ok) await fetch_()
  }

  return { offers, isLoading, syncing, syncAll, publishGroup, deleteCreative, refresh: fetch_ }
}

const UPLOADER_COLORS: Record<string, string> = {
  janne: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  facu: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  benjamin: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

function getUploaderColor(name: string | null) {
  if (!name) return 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
  return UPLOADER_COLORS[name.toLowerCase()] || 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
}

function OfferTesteoSelector({ offerId, offerName, testeo, onChange }: {
  offerId: string; offerName: string; testeo: number; onChange: (n: number) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={(e) => { e.stopPropagation(); onChange(Math.max(1, testeo - 1)) }}
        className="h-5 w-5 rounded flex items-center justify-center text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-800/30 transition-colors text-xs font-bold"
      >-</button>
      <span className="text-xs num font-bold text-indigo-600 dark:text-indigo-400 min-w-[36px] text-center bg-indigo-50 dark:bg-indigo-900/20 rounded px-1.5 py-0.5">
        TT{testeo}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onChange(testeo + 1) }}
        className="h-5 w-5 rounded flex items-center justify-center text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-800/30 transition-colors text-xs font-bold"
      >+</button>
    </div>
  )
}

export default function Creativos() {
  const { getTesteo, setOfferTesteo } = useOfferTesteos()
  const { offers, isLoading, syncing, syncAll, publishGroup, deleteCreative } = useAllCreatives()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggleExpand = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  // Filter groups per offer by their testeo
  function getFilteredGroups(offer: OfferCreatives) {
    const tt = getTesteo(offer.offer_id)
    return offer.groups.filter(g => g.testeo_number === tt)
  }

  function getFilteredTotals(offer: OfferCreatives) {
    const groups = getFilteredGroups(offer)
    return {
      videos: groups.filter(g => g.creative_type === 'video').reduce((s, g) => s + g.files.length, 0),
      images: groups.filter(g => g.creative_type === 'imagen').reduce((s, g) => s + g.files.length, 0),
      subido: groups.reduce((s, g) => s + g.subido, 0),
      publicado: groups.reduce((s, g) => s + g.publicado, 0),
    }
  }

  const globalTotals = offers.reduce((acc, o) => {
    const t = getFilteredTotals(o)
    return { videos: acc.videos + t.videos, images: acc.images + t.images, subido: acc.subido + t.subido, publicado: acc.publicado + t.publicado }
  }, { videos: 0, images: 0, subido: 0, publicado: 0 })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Palette size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Banco de Creativos</h1>
            <p className="text-xs text-slate-500">Anuncios por oferta — cada oferta tiene su testeo</p>
          </div>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={syncAll}
          disabled={syncing}
          className="gap-1.5 text-xs"
        >
          <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Sincronizando...' : 'Sincronizar Drive'}
        </Button>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Video size={12} className="text-purple-500" />
              <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase">Videos</span>
            </div>
            <span className="text-xl num font-bold text-purple-600 dark:text-purple-400">{globalTotals.videos}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <ImageIcon size={12} className="text-blue-500" />
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase">Imagenes</span>
            </div>
            <span className="text-xl num font-bold text-blue-600 dark:text-blue-400">{globalTotals.images}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Clock size={12} className="text-amber-500" />
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase">Pendientes</span>
            </div>
            <span className="text-xl num font-bold text-amber-600 dark:text-amber-400">{globalTotals.subido}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <CheckCircle2 size={12} className="text-emerald-500" />
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase">Publicados</span>
            </div>
            <span className="text-xl num font-bold text-emerald-600 dark:text-emerald-400">{globalTotals.publicado}</span>
          </CardContent>
        </Card>
      </div>

      {/* Offers */}
      {isLoading ? (
        <LoadingSpinner />
      ) : offers.length === 0 ? (
        <EmptyState
          icon={Palette}
          title="Sin creativos"
          description="No hay ofertas con carpetas de Drive vinculadas."
        />
      ) : (
        <div className="space-y-3">
          {offers.map(offer => {
            const tt = getTesteo(offer.offer_id)
            const filtered = getFilteredGroups(offer)
            const totals = getFilteredTotals(offer)

            return (
              <Card key={offer.offer_id}>
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors rounded-t-lg"
                  onClick={() => toggleExpand(offer.offer_id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {(expanded[offer.offer_id] ?? true) ? <ChevronDown size={14} className="text-slate-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />}
                    <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">{offer.offer_name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <OfferTesteoSelector
                      offerId={offer.offer_id}
                      offerName={offer.offer_name}
                      testeo={tt}
                      onChange={(n) => setOfferTesteo(offer.offer_id, n)}
                    />
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Video size={10} /> {totals.videos}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <ImageIcon size={10} /> {totals.images}
                    </Badge>
                    {totals.subido > 0 && (
                      <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200">
                        {totals.subido} por publicar
                      </Badge>
                    )}
                  </div>
                </div>

                {(expanded[offer.offer_id] ?? true) && (
                  <CardContent className="px-3 pb-3 pt-0 space-y-2">
                    {filtered.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-2">Sin creativos en TT{tt} — total en carpeta: {offer.totals.videos + offer.totals.images} archivos</p>
                    ) : (
                      filtered.map(group => (
                        <div key={`${group.creative_type}-${group.testeo_number}`} className="rounded-lg border border-slate-100 dark:border-slate-700/50 overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50">
                            <div className="flex items-center gap-2">
                              {group.creative_type === 'video' ? (
                                <Video size={12} className="text-purple-500" />
                              ) : (
                                <ImageIcon size={12} className="text-blue-500" />
                              )}
                              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                {group.testeo} — {group.creative_type === 'video' ? 'Videos' : 'Imagenes'}
                              </span>
                              <span className="text-[10px] text-slate-400">({group.files.length})</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {group.subido > 0 && (
                                <button
                                  onClick={() => publishGroup(offer.offer_folder_id, group.testeo_number, group.creative_type)}
                                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 font-semibold transition-colors"
                                >
                                  <CheckCircle2 size={10} />
                                  Publicar ({group.subido})
                                </button>
                              )}
                              {group.publicado > 0 && (
                                <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-0.5">
                                  <CheckCircle2 size={10} /> {group.publicado} pub
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="divide-y divide-slate-50 dark:divide-slate-800">
                            {group.files.map(file => (
                              <div key={file.id} className="group/file flex items-center gap-2 px-3 py-1.5 text-xs">
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                  file.status === 'publicado' ? 'bg-emerald-500' : 'bg-amber-400'
                                }`} />
                                <span className="flex-1 truncate text-slate-600 dark:text-slate-300 min-w-0">
                                  {file.file_name}
                                </span>
                                {file.uploaded_by && (
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold capitalize flex-shrink-0 ${getUploaderColor(file.uploaded_by)}`}>
                                    {file.uploaded_by}
                                  </span>
                                )}
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                                  file.status === 'publicado'
                                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                                    : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                                }`}>
                                  {file.status}
                                </span>
                                <button
                                  onClick={() => deleteCreative(file.id)}
                                  className="opacity-0 group-hover/file:opacity-100 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 transition-all flex-shrink-0"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

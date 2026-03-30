import { useState, useEffect, useCallback } from 'react'
import { Video, ImageIcon, Target, RefreshCw, CheckCircle2, Clock, ChevronDown, ChevronRight, Palette } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { useCurrentTesteo } from '@/hooks/useSettings'
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

function useWeeklyCreatives(testeo: number) {
  const [offers, setOffers] = useState<OfferCreatives[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const fetch_ = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/drive-offer-sync?action=weekly-creatives&testeo=${testeo}`)
      if (res.ok) {
        const data = await res.json()
        setOffers(data.offers || [])
      }
    } catch {}
    setIsLoading(false)
  }, [testeo])

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

  return { offers, isLoading, syncing, syncAll, publishGroup, refresh: fetch_ }
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

export default function Creativos() {
  const { testeo, setCurrentTesteo } = useCurrentTesteo()
  const { offers, isLoading, syncing, syncAll, publishGroup } = useWeeklyCreatives(testeo)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggleExpand = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  const totalVideos = offers.reduce((s, o) => s + o.totals.videos, 0)
  const totalImages = offers.reduce((s, o) => s + o.totals.images, 0)
  const totalPendientes = offers.reduce((s, o) => s + o.totals.subido, 0)
  const totalPublicados = offers.reduce((s, o) => s + o.totals.publicado, 0)

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
            <p className="text-xs text-slate-500">Anuncios de la semana por oferta</p>
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

      {/* Testeo selector + stats */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        <Card className="sm:col-span-2 border-indigo-200 dark:border-indigo-800/50">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target size={14} className="text-indigo-500" />
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase">Testeo actual</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentTesteo(Math.max(1, testeo - 1))}
                className="h-6 w-6 rounded flex items-center justify-center text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-800/30 transition-colors text-sm font-bold"
              >-</button>
              <span className="text-lg num font-bold text-indigo-600 dark:text-indigo-400 min-w-[48px] text-center">TT{testeo}</span>
              <button
                onClick={() => setCurrentTesteo(testeo + 1)}
                className="h-6 w-6 rounded flex items-center justify-center text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-800/30 transition-colors text-sm font-bold"
              >+</button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Video size={12} className="text-purple-500" />
              <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase">Videos</span>
            </div>
            <span className="text-xl num font-bold text-purple-600 dark:text-purple-400">{totalVideos}</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <ImageIcon size={12} className="text-blue-500" />
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase">Imagenes</span>
            </div>
            <span className="text-xl num font-bold text-blue-600 dark:text-blue-400">{totalImages}</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Clock size={12} className="text-amber-500" />
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase">Pendientes</span>
            </div>
            <span className="text-xl num font-bold text-amber-600 dark:text-amber-400">{totalPendientes}</span>
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
          description="No hay ofertas con carpetas de Drive vinculadas o no hay creativos en el testeo actual."
        />
      ) : (
        <div className="space-y-3">
          {offers.map(offer => (
            <Card key={offer.offer_id}>
              <CardHeader className="p-3 pb-0 cursor-pointer" onClick={() => toggleExpand(offer.offer_id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {expanded[offer.offer_id] ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                    <CardTitle className="text-sm font-semibold">{offer.offer_name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Video size={10} /> {offer.totals.videos}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <ImageIcon size={10} /> {offer.totals.images}
                    </Badge>
                    {offer.totals.subido > 0 && (
                      <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200">
                        {offer.totals.subido} por publicar
                      </Badge>
                    )}
                    {offer.totals.publicado > 0 && (
                      <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200">
                        {offer.totals.publicado} publicados
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>

              {(expanded[offer.offer_id] ?? true) && (
                <CardContent className="p-3 pt-2 space-y-2">
                  {offer.groups.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-2">Sin creativos en TT{testeo}</p>
                  ) : (
                    offer.groups.map(group => (
                      <div key={`${group.creative_type}-${group.testeo_number}`} className="rounded-lg border border-slate-100 dark:border-slate-700/50 overflow-hidden">
                        {/* Group header */}
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

                        {/* Files list */}
                        <div className="divide-y divide-slate-50 dark:divide-slate-800">
                          {group.files.map(file => (
                            <div key={file.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
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
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { Video, ImageIcon, Target, RefreshCw, CheckCircle2, Clock, ChevronDown, ChevronRight, Palette, X, CalendarClock, Square, CheckSquare2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
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
  status: 'subido' | 'programado' | 'publicado'
  published_at: string | null
  scheduled_at: string | null
  uploaded_by: string | null
  detected_at: string
}

interface CreativeGroup {
  creative_type: string
  testeo: string
  testeo_number: number
  files: CreativeFile[]
  subido: number
  programado: number
  publicado: number
}

interface OfferCreatives {
  offer_id: string
  offer_folder_id: string
  offer_name: string
  last_sync: string | null
  groups: CreativeGroup[]
  totals: { videos: number; images: number; subido: number; programado: number; publicado: number }
}

function useAllCreatives() {
  const [offers, setOffers] = useState<OfferCreatives[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const fetch_ = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/drive-offer-sync?action=weekly-creatives')
      if (res.ok) setOffers((await res.json()).offers || [])
    } catch {}
    setIsLoading(false)
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  async function syncAll() {
    setSyncing(true)
    try { await fetch('/api/drive-offer-sync?action=sync-all'); await fetch_(); toast.success('Sincronizado') }
    catch { toast.error('Error al sincronizar') }
    setSyncing(false)
  }

  async function publishOne(creativeId: string) {
    setOffers(prev => prev.map(o => ({
      ...o, groups: o.groups.map(g => ({ ...g, files: g.files.map(f => f.id === creativeId ? { ...f, status: 'publicado' as const, published_at: new Date().toISOString(), scheduled_at: null } : f) })),
    })))
    const res = await fetch('/api/drive-offer-sync?action=publish-one', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creative_id: creativeId }) })
    if (!res.ok) await fetch_()
  }

  async function scheduleBatch(ids: string[], date: string) {
    setOffers(prev => prev.map(o => ({
      ...o, groups: o.groups.map(g => ({ ...g, files: g.files.map(f => ids.includes(f.id) ? { ...f, status: 'programado' as const, scheduled_at: date } : f) })),
    })))
    const res = await fetch('/api/drive-offer-sync?action=schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creative_ids: ids, scheduled_at: date }) })
    if (!res.ok) await fetch_()
    else toast.success(`${ids.length} ads programados para ${new Date(date + 'T12:00:00').toLocaleDateString('es-AR')}`)
  }

  async function deleteCreative(creativeId: string) {
    setOffers(prev => prev.map(o => ({
      ...o, groups: o.groups.map(g => ({ ...g, files: g.files.filter(f => f.id !== creativeId) })).filter(g => g.files.length > 0),
    })))
    const res = await fetch('/api/drive-offer-sync?action=delete-creative', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creative_id: creativeId }) })
    if (!res.ok) await fetch_()
  }

  return { offers, isLoading, syncing, syncAll, publishOne, scheduleBatch, deleteCreative, refresh: fetch_ }
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

function OfferTesteoSelector({ offerId, testeo, onChange }: {
  offerId: string; testeo: number; onChange: (n: number) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={(e) => { e.stopPropagation(); onChange(Math.max(1, testeo - 1)) }} className="h-5 w-5 rounded flex items-center justify-center text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-800/30 transition-colors text-xs font-bold">-</button>
      <span className="text-xs num font-bold text-indigo-600 dark:text-indigo-400 min-w-[36px] text-center bg-indigo-50 dark:bg-indigo-900/20 rounded px-1.5 py-0.5">TT{testeo}</span>
      <button onClick={(e) => { e.stopPropagation(); onChange(testeo + 1) }} className="h-5 w-5 rounded flex items-center justify-center text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-800/30 transition-colors text-xs font-bold">+</button>
    </div>
  )
}

function formatScheduleDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

export default function Creativos() {
  const { getTesteo, setOfferTesteo } = useOfferTesteos()
  const { offers, isLoading, syncing, syncAll, publishOne, scheduleBatch, deleteCreative } = useAllCreatives()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [batchDate, setBatchDate] = useState('')
  const [showBatchDate, setShowBatchDate] = useState(false)

  const toggleExpand = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function selectAllInGroup(files: CreativeFile[]) {
    setSelected(prev => {
      const next = new Set(prev)
      const unpublished = files.filter(f => f.status !== 'publicado')
      const allSelected = unpublished.every(f => next.has(f.id))
      if (allSelected) unpublished.forEach(f => next.delete(f.id))
      else unpublished.forEach(f => next.add(f.id))
      return next
    })
  }

  function handleBatchSchedule() {
    if (!batchDate || selected.size === 0) return
    scheduleBatch([...selected], batchDate)
    setSelected(new Set())
    setBatchDate('')
    setShowBatchDate(false)
  }

  function handleBatchPublish() {
    const ids = [...selected]
    ids.forEach(id => publishOne(id))
    setSelected(new Set())
    toast.success(`${ids.length} ads publicados`)
  }

  function getFilteredGroups(offer: OfferCreatives) {
    return offer.groups.filter(g => g.testeo_number === getTesteo(offer.offer_id))
  }

  function getFilteredTotals(offer: OfferCreatives) {
    const groups = getFilteredGroups(offer)
    return {
      videos: groups.filter(g => g.creative_type === 'video').reduce((s, g) => s + g.files.length, 0),
      images: groups.filter(g => g.creative_type === 'imagen').reduce((s, g) => s + g.files.length, 0),
      subido: groups.reduce((s, g) => s + g.subido, 0),
      programado: groups.reduce((s, g) => s + g.programado, 0),
      publicado: groups.reduce((s, g) => s + g.publicado, 0),
    }
  }

  const globalTotals = offers.reduce((acc, o) => {
    const t = getFilteredTotals(o)
    return { videos: acc.videos + t.videos, images: acc.images + t.images, subido: acc.subido + t.subido, programado: acc.programado + t.programado, publicado: acc.publicado + t.publicado }
  }, { videos: 0, images: 0, subido: 0, programado: 0, publicado: 0 })

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
            <p className="text-xs text-slate-500">Selecciona ads y programalos por fecha</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={syncAll} disabled={syncing} className="gap-1.5 text-xs">
          <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Sincronizando...' : 'Sincronizar Drive'}
        </Button>
      </div>

      {/* Batch action bar */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-20 flex items-center gap-2 p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/50 shadow-sm">
          <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
            {selected.size} seleccionados
          </span>
          <div className="flex-1" />
          {showBatchDate ? (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={batchDate}
                onChange={e => setBatchDate(e.target.value)}
                className="text-xs h-7 px-2 rounded border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                autoFocus
              />
              <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" disabled={!batchDate} onClick={handleBatchSchedule}>
                Programar {selected.size}
              </Button>
              <button onClick={() => setShowBatchDate(false)} className="text-indigo-400 hover:text-indigo-600 p-1"><X size={14} /></button>
            </div>
          ) : (
            <>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-indigo-300 text-indigo-700 dark:text-indigo-300" onClick={() => setShowBatchDate(true)}>
                <CalendarClock size={12} /> Programar
              </Button>
              <Button size="sm" className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleBatchPublish}>
                <CheckCircle2 size={12} /> Publicar
              </Button>
              <button onClick={() => setSelected(new Set())} className="text-indigo-400 hover:text-indigo-600 p-1"><X size={14} /></button>
            </>
          )}
        </div>
      )}

      {/* Global stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { icon: Video, color: 'purple', label: 'Videos', value: globalTotals.videos },
          { icon: ImageIcon, color: 'blue', label: 'Imagenes', value: globalTotals.images },
          { icon: Clock, color: 'amber', label: 'Pendientes', value: globalTotals.subido },
          { icon: CalendarClock, color: 'indigo', label: 'Programados', value: globalTotals.programado },
          { icon: CheckCircle2, color: 'emerald', label: 'Publicados', value: globalTotals.publicado },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <s.icon size={12} className={`text-${s.color}-500`} />
                <span className={`text-[10px] font-semibold text-${s.color}-600 dark:text-${s.color}-400 uppercase`}>{s.label}</span>
              </div>
              <span className={`text-xl num font-bold text-${s.color}-600 dark:text-${s.color}-400`}>{s.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Offers */}
      {isLoading ? (
        <LoadingSpinner />
      ) : offers.length === 0 ? (
        <EmptyState icon={Palette} title="Sin creativos" description="No hay ofertas con carpetas de Drive vinculadas." />
      ) : (
        <div className="space-y-3">
          {offers.map(offer => {
            const tt = getTesteo(offer.offer_id)
            const filtered = getFilteredGroups(offer)
            const totals = getFilteredTotals(offer)

            return (
              <Card key={offer.offer_id}>
                <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors rounded-t-lg" onClick={() => toggleExpand(offer.offer_id)}>
                  <div className="flex items-center gap-2 min-w-0">
                    {(expanded[offer.offer_id] ?? true) ? <ChevronDown size={14} className="text-slate-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />}
                    <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">{offer.offer_name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <OfferTesteoSelector offerId={offer.offer_id} testeo={tt} onChange={(n) => setOfferTesteo(offer.offer_id, n)} />
                    <Badge variant="outline" className="text-[10px] gap-1"><Video size={10} /> {totals.videos}</Badge>
                    <Badge variant="outline" className="text-[10px] gap-1"><ImageIcon size={10} /> {totals.images}</Badge>
                    {totals.subido > 0 && <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200">{totals.subido} pendientes</Badge>}
                    {totals.programado > 0 && <Badge className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200">{totals.programado} prog</Badge>}
                  </div>
                </div>

                {(expanded[offer.offer_id] ?? true) && (
                  <CardContent className="px-3 pb-3 pt-0 space-y-2">
                    {filtered.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-2">Sin creativos en TT{tt}</p>
                    ) : (
                      filtered.map(group => {
                        const unpublished = group.files.filter(f => f.status !== 'publicado')
                        const allGroupSelected = unpublished.length > 0 && unpublished.every(f => selected.has(f.id))

                        return (
                          <div key={`${group.creative_type}-${group.testeo_number}`} className="rounded-lg border border-slate-100 dark:border-slate-700/50 overflow-hidden">
                            {/* Group header */}
                            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50">
                              <div className="flex items-center gap-2">
                                {unpublished.length > 0 && (
                                  <button onClick={() => selectAllInGroup(group.files)} className="flex-shrink-0">
                                    {allGroupSelected
                                      ? <CheckSquare2 size={13} className="text-indigo-500" />
                                      : <Square size={13} className="text-slate-300 dark:text-slate-600" />}
                                  </button>
                                )}
                                {group.creative_type === 'video' ? <Video size={12} className="text-purple-500" /> : <ImageIcon size={12} className="text-blue-500" />}
                                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                  {group.testeo} — {group.creative_type === 'video' ? 'Videos' : 'Imagenes'}
                                </span>
                                <span className="text-[10px] text-slate-400">({group.files.length})</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {group.programado > 0 && (
                                  <span className="text-[10px] text-indigo-500 font-semibold flex items-center gap-0.5">
                                    <CalendarClock size={10} /> {group.programado}
                                  </span>
                                )}
                                {group.publicado > 0 && (
                                  <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-0.5">
                                    <CheckCircle2 size={10} /> {group.publicado}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Files */}
                            <div className="divide-y divide-slate-50 dark:divide-slate-800">
                              {group.files.map(file => {
                                const isSelected = selected.has(file.id)
                                const isPublished = file.status === 'publicado'

                                return (
                                  <div
                                    key={file.id}
                                    className={`group/file flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
                                  >
                                    {/* Checkbox */}
                                    {!isPublished ? (
                                      <button onClick={() => toggleSelect(file.id)} className="flex-shrink-0">
                                        {isSelected
                                          ? <CheckSquare2 size={13} className="text-indigo-500" />
                                          : <Square size={13} className="text-slate-300 dark:text-slate-600" />}
                                      </button>
                                    ) : (
                                      <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
                                    )}

                                    {/* File name */}
                                    <span className={`flex-1 truncate min-w-0 ${isPublished ? 'text-slate-400 line-through' : 'text-slate-600 dark:text-slate-300'}`}>
                                      {file.file_name}
                                    </span>

                                    {/* Uploader */}
                                    {file.uploaded_by && (
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold capitalize flex-shrink-0 ${getUploaderColor(file.uploaded_by)}`}>
                                        {file.uploaded_by}
                                      </span>
                                    )}

                                    {/* Status / schedule date */}
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                                      file.status === 'publicado'
                                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                                        : file.status === 'programado'
                                        ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400'
                                        : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                                    }`}>
                                      {file.status === 'programado' && file.scheduled_at
                                        ? formatScheduleDate(file.scheduled_at)
                                        : file.status}
                                    </span>

                                    {/* Inline actions */}
                                    {!isPublished && (
                                      <button
                                        onClick={() => publishOne(file.id)}
                                        className="opacity-0 group-hover/file:opacity-100 text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-semibold transition-all flex-shrink-0"
                                      >Pub</button>
                                    )}
                                    <button
                                      onClick={() => deleteCreative(file.id)}
                                      className="opacity-0 group-hover/file:opacity-100 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 transition-all flex-shrink-0"
                                    ><X size={12} /></button>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })
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

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ShoppingBag, CheckCircle2, XCircle, ExternalLink, RefreshCw, Plug, HardDrive, FolderSync, Loader2, Download, BarChart3, Zap, CalendarDays, FileSpreadsheet } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useShopifyStores } from '@/hooks/useShopifyStores'
import { useGoogleConnection, useDriveFiles } from '@/hooks/useDriveFiles'
import { useUtmifyConfig } from '@/hooks/useUtmify'
import { useCalendarStatus } from '@/hooks/useCalendar'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

const CONFIGURED_SHOPS = [
  {
    shop: 'las-recetas-de-ana.myshopify.com',
    displayName: 'Las Recetas de Ana',
    customDomain: 'lasrecetasdeana.com',
  },
  {
    shop: 'panaderia-con-ana-internacional.myshopify.com',
    displayName: 'Instant Handbook',
    customDomain: 'instanthandbook.com',
  },
]

export default function Integrations() {
  const { stores, isLoading, refresh } = useShopifyStores()
  const { connection: googleConn, isLoading: googleLoading, refresh: refreshGoogle } = useGoogleConnection()
  const { files: driveFiles, refresh: refreshFiles } = useDriveFiles()
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  const isAdmin = profile?.role === 'admin'
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    if (searchParams.get('connected') === '1') {
      const shop = searchParams.get('shop')
      toast.success(`Tienda ${shop} conectada exitosamente`)
      refresh()
    }
    if (searchParams.get('error')) {
      toast.error(`Error de Shopify: ${searchParams.get('error_description') || searchParams.get('error')}`)
    }
    if (searchParams.get('google_connected') === '1') {
      const email = searchParams.get('email')
      toast.success(`Google Drive conectado: ${email}`)
      refreshGoogle()
    }
    if (searchParams.get('google_error')) {
      toast.error(`Error de Google: ${searchParams.get('google_error')}`)
    }
  }, [searchParams])

  function connectShop(shop: string) {
    window.location.href = `/api/shopify-token?shop=${encodeURIComponent(shop)}`
  }

  function connectGoogle() {
    window.location.href = '/api/google-auth'
  }

  async function syncDrive() {
    setSyncing(true)
    try {
      const res = await fetch('/api/drive-offer-sync?action=sync-all')
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Error al sincronizar')
        return
      }
      toast.success(`Sincronizado: ${data.synced ?? 0} ofertas, ${data.total_detected ?? 0} archivos detectados`)
      refreshFiles()
    } catch (err: any) {
      toast.error(err.message || 'Error de red')
    } finally {
      setSyncing(false)
    }
  }

  const creativos = driveFiles.filter(f => f.folder_type === 'anuncios')

  // Google Calendar
  const { status: calendarStatus, isLoading: calendarLoading } = useCalendarStatus()
  const [generatingTasks, setGeneratingTasks] = useState(false)

  async function generateAutoTasks() {
    setGeneratingTasks(true)
    try {
      const res = await fetch('/api/calendar?action=auto-tasks')
      const data = await res.json()
      if (data.created > 0) {
        toast.success(`${data.created} tareas automaticas creadas`)
      } else {
        toast.info('No hay tareas automaticas pendientes')
      }
    } catch (err: any) { toast.error(err.message) }
    finally { setGeneratingTasks(false) }
  }
  const ofertas = driveFiles.filter(f => f.folder_type === 'ofertas')

  // UTMify
  const { config: utmifyConfig, isLoading: utmifyLoading, refresh: refreshUtmify, saveConfig: saveUtmifyConfig } = useUtmifyConfig()
  const [utmifyTesting, setUtmifyTesting] = useState(false)
  const [utmifySyncing, setUtmifySyncing] = useState(false)
  const [utmifyMcpUrl, setUtmifyMcpUrl] = useState('')

  useEffect(() => {
    if (utmifyConfig) setUtmifyMcpUrl(utmifyConfig.mcp_url)
  }, [utmifyConfig])

  async function testUtmifyConnection() {
    setUtmifyTesting(true)
    try {
      const res = await fetch('/api/utmify?action=test-connection')
      const data = await res.json()
      if (data.ok) {
        toast.success('Conexion UTMify exitosa')
      } else {
        toast.error(`Error: ${data.error}`)
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setUtmifyTesting(false)
    }
  }

  async function syncUtmify(days = 30) {
    setUtmifySyncing(true)
    try {
      const res = await fetch(`/api/utmify?action=sync&days=${days}`)
      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
      } else {
        toast.success(`Sincronizado: ${data.synced} campanas — Revenue: US$ ${data.summary?.revenue || 0}`)
        refreshUtmify()
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setUtmifySyncing(false)
    }
  }

  async function saveUtmifyUrl() {
    if (!utmifyMcpUrl.trim()) return
    const { error } = await saveUtmifyConfig({ mcp_url: utmifyMcpUrl.trim() } as any)
    if (error) toast.error(error)
    else toast.success('URL MCP actualizada')
  }

  // Google Sheets WA
  const [sheetsId, setSheetsId] = useState('')
  const [sheetsSalesName, setSheetsSalesName] = useState('Ventas WA')
  const [sheetsContactsName, setSheetsContactsName] = useState('Contactos WA')
  const [sheetsConfig, setSheetsConfig] = useState<any>(null)
  const [sheetsLoading, setSheetsLoading] = useState(true)
  const [sheetsTesting, setSheetsTesting] = useState(false)
  const [sheetsSyncing, setSheetsSyncing] = useState(false)
  const [sheetsSaving, setSheetsSaving] = useState(false)

  useEffect(() => {
    fetch('/api/external/sheets/config').then(r => r.json()).then(d => {
      if (d.success && d.data) {
        setSheetsConfig(d.data)
        setSheetsId(d.data.spreadsheet_id || '')
        setSheetsSalesName(d.data.sales_sheet_name || 'Ventas WA')
        setSheetsContactsName(d.data.contacts_sheet_name || 'Contactos WA')
      }
      setSheetsLoading(false)
    }).catch(() => setSheetsLoading(false))
  }, [])

  async function saveSheetsConfig() {
    if (!sheetsId.trim()) return
    setSheetsSaving(true)
    try {
      const res = await fetch('/api/external/sheets/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheet_id: sheetsId.trim(), sales_sheet_name: sheetsSalesName, contacts_sheet_name: sheetsContactsName }),
      })
      const data = await res.json()
      if (data.success) { setSheetsConfig(data.data); toast.success('Configuracion guardada') }
      else toast.error(data.error)
    } catch (e: any) { toast.error(e.message) }
    finally { setSheetsSaving(false) }
  }

  async function testSheetsConnection() {
    if (!sheetsId.trim()) return
    setSheetsTesting(true)
    try {
      const res = await fetch(`/api/external/sheets/test?id=${encodeURIComponent(sheetsId)}&sales=${encodeURIComponent(sheetsSalesName)}&contacts=${encodeURIComponent(sheetsContactsName)}`)
      const data = await res.json()
      if (data.success) {
        toast.success(`Conexion OK — ${data.data.sales.total} ventas, ${data.data.contacts.total} contactos`)
      } else {
        toast.error(data.error)
      }
    } catch (e: any) { toast.error(e.message) }
    finally { setSheetsTesting(false) }
  }

  async function syncSheets() {
    setSheetsSyncing(true)
    try {
      const res = await fetch('/api/external/sheets/sync')
      const data = await res.json()
      if (data.success) {
        const d = data.data
        toast.success(`Sync OK — ${d.sales.synced} ventas, ${d.contacts.processed} contactos${d.banCheck.alerts?.length ? `, ${d.banCheck.alerts.length} alertas de baneo` : ''}`)
        setSheetsConfig((prev: any) => prev ? { ...prev, last_sync_at: d.syncedAt } : prev)
      } else {
        toast.error(data.error)
      }
    } catch (e: any) { toast.error(e.message) }
    finally { setSheetsSyncing(false) }
  }

  // Push manual — recibe JSON de campañas (desde Claude.ai)
  const [pushJson, setPushJson] = useState('')
  const [pushing, setPushing] = useState(false)
  const [showPush, setShowPush] = useState(false)

  async function handlePush() {
    if (!pushJson.trim()) return
    setPushing(true)
    try {
      let parsed = JSON.parse(pushJson)
      // Accept either { campaigns: [...] } or just [...]
      if (Array.isArray(parsed)) parsed = { campaigns: parsed }
      if (!parsed.date) parsed.date = new Date().toISOString().split('T')[0]

      const res = await fetch('/api/utmify?action=push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      })
      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
      } else {
        toast.success(`Push OK: ${data.synced} campanas — Revenue: US$ ${data.summary?.revenue || 0}`)
        setPushJson('')
        setShowPush(false)
        refreshUtmify()
      }
    } catch (err: any) {
      toast.error('JSON invalido: ' + err.message)
    } finally {
      setPushing(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Integraciones</h1>
        <p className="text-sm text-slate-500 mt-0.5">Conecta tus tiendas y servicios externos</p>
      </div>

      {/* UTMify section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-violet-500" />
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">UTMify</h2>
          <Badge variant="outline" className="text-xs text-slate-400">
            {utmifyLoading ? '...' : utmifyConfig ? 'Configurado' : 'No configurado'}
          </Badge>
        </div>

        <Card className="shadow-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800/60">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <BarChart3 size={17} className="text-violet-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Tracking financiero</p>
                  <p className="text-xs text-slate-400">Fuente unica de datos financieros</p>
                </div>
              </div>
              {utmifyConfig && (
                <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                  <CheckCircle2 size={14} />
                  <span className="text-xs font-medium">Conectado</span>
                </div>
              )}
            </div>

            {/* MCP URL */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">URL MCP</p>
              <div className="flex gap-2">
                <Input
                  className="text-xs h-8 flex-1 font-mono"
                  placeholder="https://mcp.utmify.com.br/mcp/?token=..."
                  value={utmifyMcpUrl}
                  onChange={e => setUtmifyMcpUrl(e.target.value)}
                />
                {isAdmin && utmifyMcpUrl !== (utmifyConfig?.mcp_url || '') && (
                  <Button size="sm" className="h-8 text-xs text-white" style={{ backgroundColor: '#8B5CF6' }} onClick={saveUtmifyUrl}>
                    Guardar
                  </Button>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 gap-1.5"
                disabled={utmifyTesting}
                onClick={testUtmifyConnection}
              >
                {utmifyTesting ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                Probar conexion
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 gap-1.5"
                disabled={utmifySyncing}
                onClick={() => syncUtmify(1)}
              >
                {utmifySyncing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                Sync hoy
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 gap-1.5"
                disabled={utmifySyncing}
                onClick={() => syncUtmify(30)}
              >
                {utmifySyncing ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                Sync 30 dias
              </Button>
              {utmifyConfig?.last_sync_at && (
                <span className="text-[10px] text-slate-400 ml-2">
                  Ultima sync: {new Date(utmifyConfig.last_sync_at).toLocaleString('es-AR')}
                </span>
              )}
            </div>

            {/* Push manual */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => setShowPush(!showPush)}
                className="text-xs text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300 font-medium"
              >
                {showPush ? '▾ Cerrar push manual' : '▸ Push manual (desde Claude.ai)'}
              </button>
              {showPush && (
                <div className="mt-2 space-y-2">
                  <p className="text-[10px] text-slate-400">
                    Pega el JSON de campañas que te da Claude.ai al consultar UTMify MCP.
                    Formato: {'{'} "date": "2026-03-27", "campaigns": [...] {'}'}
                  </p>
                  <textarea
                    className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    rows={5}
                    placeholder='{ "date": "2026-03-27", "campaigns": [...] }'
                    value={pushJson}
                    onChange={e => setPushJson(e.target.value)}
                  />
                  <Button
                    size="sm"
                    className="text-xs h-7 text-white gap-1.5"
                    style={{ backgroundColor: '#8B5CF6' }}
                    disabled={pushing || !pushJson.trim()}
                    onClick={handlePush}
                  >
                    {pushing ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                    {pushing ? 'Guardando...' : 'Guardar datos'}
                  </Button>
                </div>
              )}
            </div>

            {/* Auto sync toggle */}
            {utmifyConfig && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
                <div>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-200">Auto-sync</p>
                  <p className="text-[10px] text-slate-400">Sincronizar automaticamente cada {utmifyConfig.sync_interval_minutes} minutos</p>
                </div>
                <button
                  onClick={async () => {
                    const { error } = await saveUtmifyConfig({ auto_sync: !utmifyConfig.auto_sync } as any)
                    if (error) toast.error(error)
                  }}
                  className={`h-6 w-10 rounded-full relative cursor-pointer transition-colors ${utmifyConfig.auto_sync ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-600'}`}
                >
                  <div className={`h-5 w-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform ${utmifyConfig.auto_sync ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Google Sheets WA section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={16} className="text-green-600" />
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Google Sheets (WhatsApp)</h2>
          <Badge variant="outline" className="text-xs text-slate-400">
            {sheetsLoading ? '...' : sheetsConfig ? 'Configurado' : 'No configurado'}
          </Badge>
        </div>

        <Card className="shadow-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800/60">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <FileSpreadsheet size={17} className="text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Facturacion WA + Deteccion baneos</p>
                  <p className="text-xs text-slate-400">ManyChat escribe en Sheets, la app lee</p>
                </div>
              </div>
              {sheetsConfig && (
                <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                  <CheckCircle2 size={14} />
                  <span className="text-xs font-medium">Conectado</span>
                </div>
              )}
            </div>

            {/* Spreadsheet ID */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">ID de la planilla</p>
              <Input
                className="text-xs h-8 font-mono"
                placeholder="Pega el ID de la planilla de Google Sheets"
                value={sheetsId}
                onChange={e => setSheetsId(e.target.value)}
              />
              <p className="text-[10px] text-slate-400">El ID esta en la URL: docs.google.com/spreadsheets/d/<strong>ESTE_ES_EL_ID</strong>/edit</p>
            </div>

            {/* Sheet names */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Hoja de ventas</p>
                <Input className="text-xs h-8" value={sheetsSalesName} onChange={e => setSheetsSalesName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Hoja de contactos</p>
                <Input className="text-xs h-8" value={sheetsContactsName} onChange={e => setSheetsContactsName(e.target.value)} />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {isAdmin && sheetsId.trim() && (
                <Button size="sm" className="text-xs h-7 text-white gap-1.5" style={{ backgroundColor: '#16A34A' }} disabled={sheetsSaving} onClick={saveSheetsConfig}>
                  {sheetsSaving ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                  Guardar
                </Button>
              )}
              <Button size="sm" variant="outline" className="text-xs h-7 gap-1.5" disabled={sheetsTesting || !sheetsId.trim()} onClick={testSheetsConnection}>
                {sheetsTesting ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                Probar conexion
              </Button>
              {sheetsConfig && (
                <Button size="sm" variant="outline" className="text-xs h-7 gap-1.5" disabled={sheetsSyncing} onClick={syncSheets}>
                  {sheetsSyncing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                  Sincronizar ahora
                </Button>
              )}
              {sheetsConfig?.last_sync_at && (
                <span className="text-[10px] text-slate-400 ml-2">
                  Ultima sync: {new Date(sheetsConfig.last_sync_at).toLocaleString('es-AR')}
                </span>
              )}
            </div>

            {sheetsConfig && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  <strong>Deteccion de baneos:</strong> Cada sync analiza la actividad por numero. Si un numero deja de recibir contactos y ventas durante 6+ horas en horario de ads, se genera una alerta automatica.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Google Calendar section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-blue-500" />
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Google Calendar</h2>
          <Badge variant="outline" className="text-xs text-slate-400">
            {calendarLoading ? '...' : calendarStatus.connected ? 'Conectado' : 'No conectado'}
          </Badge>
        </div>

        <Card className="shadow-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800/60">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <CalendarDays size={17} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Tareas del dia</p>
                  <p className="text-xs text-slate-400">Sync bidireccional con Google Calendar</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {calendarStatus.connected ? (
                  <>
                    <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                      <CheckCircle2 size={14} />
                      <span className="text-xs font-medium">{calendarStatus.email}</span>
                    </div>
                    {isAdmin && (
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => window.location.href = '/api/google-auth'}>
                        <RefreshCw size={11} className="mr-1" /> Reconectar
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <XCircle size={14} />
                      <span className="text-xs font-medium">No conectado</span>
                    </div>
                    {isAdmin && (
                      <Button size="sm" className="text-white text-xs h-7" style={{ backgroundColor: '#4285f4' }} onClick={() => window.location.href = '/api/google-auth'}>
                        <Plug size={11} className="mr-1" /> Conectar Google
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            {calendarStatus.connected && (
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1.5"
                  disabled={generatingTasks}
                  onClick={generateAutoTasks}
                >
                  {generatingTasks ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                  Generar tareas automaticas
                </Button>
                <span className="text-[10px] text-slate-400">Detecta numeros WA por vencer/baneados y ofertas sin creativos</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Google Drive section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <HardDrive size={16} className="text-[#4285f4]" />
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Google Drive</h2>
          {!googleLoading && (
            <Badge variant="outline" className="text-xs text-slate-400">
              {googleConn ? 'Conectado' : 'No conectado'}
            </Badge>
          )}
        </div>

        <Card className="shadow-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-[#4285f4]/10 flex items-center justify-center">
                  <HardDrive size={17} className="text-[#4285f4]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Monitoreo de carpetas</p>
                  <p className="text-xs text-slate-400 font-mono">Anuncios + OFERTAS</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {googleConn ? (
                  <>
                    <div className="flex items-center gap-1.5 text-green-600">
                      <CheckCircle2 size={14} />
                      <span className="text-xs font-medium">{googleConn.email}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      disabled={syncing}
                      onClick={syncDrive}
                    >
                      {syncing ? <Loader2 size={11} className="mr-1 animate-spin" /> : <FolderSync size={11} className="mr-1" />}
                      Sincronizar
                    </Button>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={connectGoogle}
                      >
                        <RefreshCw size={11} className="mr-1" /> Reconectar
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <XCircle size={14} />
                      <span className="text-xs font-medium">No conectado</span>
                    </div>
                    {isAdmin && (
                      <Button
                        size="sm"
                        className="text-white text-xs h-7"
                        style={{ backgroundColor: '#4285f4' }}
                        onClick={connectGoogle}
                      >
                        <Plug size={11} className="mr-1" /> Conectar Google
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            {googleConn && (
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span>
                    Conectado el{' '}
                    {new Date(googleConn.connected_at).toLocaleDateString('es-AR', {
                      day: 'numeric', month: 'long', year: 'numeric'
                    })}
                  </span>
                  <span>{creativos.length} creativos detectados</span>
                  <span>{ofertas.length} archivos de ofertas</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent drive files */}
        {driveFiles.length > 0 && (
          <Card className="shadow-sm border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">Ultimos archivos detectados</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {driveFiles.slice(0, 10).map(f => (
                  <div key={f.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 ${f.folder_type === 'anuncios'
                          ? 'border-purple-200 text-purple-700 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-700/50'
                          : 'border-blue-200 text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-700/50'
                        }`}
                      >
                        {f.folder_type === 'anuncios' ? 'AD' : f.file_type?.toUpperCase() || 'FILE'}
                      </Badge>
                      <span className="text-slate-600 dark:text-slate-300 font-mono truncate max-w-[300px]">{f.file_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      {f.editor && <span className="font-medium">{f.editor}</span>}
                      {f.offer_name && <span>{f.offer_name}</span>}
                      {f.web_view_link && (
                        <a href={f.web_view_link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-sm border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Carpetas monitoreadas</p>
            <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
              <li><strong>Anuncios</strong>: detecta creativos por nomenclatura AD[n].TT[n].[EDITOR].[Oferta]</li>
              <li><strong>OFERTAS</strong>: detecta subcarpetas OFERTA.[Nombre].[Fecha] con AVATAR, BRIEF, COPY, LANDING, RESULTADO</li>
              <li>Sincroniza manualmente o se ejecuta automaticamente</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Shopify section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag size={16} className="text-[#96bf48]" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Shopify</h2>
            <Badge variant="outline" className="text-xs text-slate-400">
              {isLoading ? '...' : `${stores.filter(s => s.is_active).length} conectada${stores.filter(s => s.is_active).length !== 1 ? 's' : ''}`}
            </Badge>
            <Badge variant="outline" className="text-[10px] border-amber-200 text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700/50">
              Financiero via UTMify
            </Badge>
          </div>
        </div>

        <div className="space-y-3">
          {CONFIGURED_SHOPS.map(cfg => {
            const connected = stores.find(s => s.shop === cfg.shop && s.is_active)
            return (
              <Card key={cfg.shop} className="shadow-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800/60">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-[#96bf48]/10 flex items-center justify-center">
                        <ShoppingBag size={17} className="text-[#96bf48]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{cfg.displayName}</p>
                        <p className="text-xs text-slate-400 font-mono">{cfg.customDomain}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {connected ? (
                        <>
                          <div className="flex items-center gap-1.5 text-green-600">
                            <CheckCircle2 size={14} />
                            <span className="text-xs font-medium">Conectada</span>
                          </div>
                          {connected.webhook_id ? (
                            <Badge variant="outline" className="text-xs border-green-200 text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 dark:border-green-700/50">
                              Webhook activo
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs border-amber-200 text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700/50">
                              Sin webhook
                            </Badge>
                          )}
                          {isAdmin && (
                            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => connectShop(cfg.shop)}>
                              <RefreshCw size={11} className="mr-1" /> Reconectar
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <XCircle size={14} />
                            <span className="text-xs font-medium">No conectada</span>
                          </div>
                          {isAdmin && (
                            <Button size="sm" className="text-white text-xs h-7" style={{ backgroundColor: '#96bf48' }} onClick={() => connectShop(cfg.shop)}>
                              <Plug size={11} className="mr-1" /> Conectar
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {connected && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center gap-4 text-xs text-slate-400">
                      <span>
                        Conectada el{' '}
                        {new Date(connected.installed_at).toLocaleDateString('es-AR', {
                          day: 'numeric', month: 'long', year: 'numeric'
                        })}
                      </span>
                      <a href={`https://${cfg.customDomain}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-500 hover:text-blue-700">
                        <ExternalLink size={10} /> Ver tienda
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

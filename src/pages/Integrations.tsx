import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ShoppingBag, CheckCircle2, XCircle, ExternalLink, RefreshCw, Plug, HardDrive, FolderSync, Loader2, Download } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useShopifyStores } from '@/hooks/useShopifyStores'
import { useGoogleConnection, useDriveFiles } from '@/hooks/useDriveFiles'
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
  const [importing, setImporting] = useState(false)

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
      const res = await fetch('/api/google-drive-sync')
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Error al sincronizar')
        return
      }
      toast.success(`Sincronizado: ${data.synced.anuncios} creativos, ${data.synced.ofertas} archivos de ofertas`)
      refreshFiles()
    } catch (err: any) {
      toast.error(err.message || 'Error de red')
    } finally {
      setSyncing(false)
    }
  }

  async function importShopifyOrders() {
    setImporting(true)
    try {
      const res = await fetch('/api/shopify-import?days=30')
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Error al importar')
        return
      }
      const shopSummaries = data.shops
        .map((s: any) => `${s.shop}: ${s.synced} nuevas, ${s.skipped} omitidas`)
        .join(' | ')
      toast.success(`Importado: ${shopSummaries}`)
    } catch (err: any) {
      toast.error(err.message || 'Error de red')
    } finally {
      setImporting(false)
    }
  }

  const creativos = driveFiles.filter(f => f.folder_type === 'anuncios')
  const ofertas = driveFiles.filter(f => f.folder_type === 'ofertas')

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Integraciones</h1>
        <p className="text-sm text-slate-500 mt-0.5">Conecta tus tiendas y servicios externos</p>
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
              <p className="text-xs font-medium text-slate-600 mb-2">Ultimos archivos detectados</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {driveFiles.slice(0, 10).map(f => (
                  <div key={f.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 ${f.folder_type === 'anuncios'
                          ? 'border-purple-200 text-purple-700 bg-purple-50'
                          : 'border-blue-200 text-blue-700 bg-blue-50'
                        }`}
                      >
                        {f.folder_type === 'anuncios' ? 'AD' : f.file_type?.toUpperCase() || 'FILE'}
                      </Badge>
                      <span className="text-slate-600 font-mono truncate max-w-[300px]">{f.file_name}</span>
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
            <p className="text-xs font-medium text-slate-600 mb-1">Carpetas monitoreadas</p>
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
          </div>
          {isAdmin && stores.some(s => s.is_active) && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 gap-1.5"
              disabled={importing}
              onClick={importShopifyOrders}
            >
              {importing ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              {importing ? 'Importando...' : 'Importar ultimos 30 dias'}
            </Button>
          )}
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
                            <Badge variant="outline" className="text-xs border-green-200 text-green-700 bg-green-50">
                              Webhook activo
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs border-amber-200 text-amber-700 bg-amber-50">
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

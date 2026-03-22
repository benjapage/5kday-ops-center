import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ShoppingBag, CheckCircle2, XCircle, ExternalLink, RefreshCw, Plug } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useShopifyStores } from '@/hooks/useShopifyStores'
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
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    if (searchParams.get('connected') === '1') {
      const shop = searchParams.get('shop')
      toast.success(`Tienda ${shop} conectada exitosamente`)
      refresh()
    }
  }, [searchParams])

  function connectShop(shop: string) {
    window.location.href = `/api/shopify-auth?shop=${encodeURIComponent(shop)}`
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Integraciones</h1>
        <p className="text-sm text-slate-500 mt-0.5">Conectá tus tiendas y servicios externos</p>
      </div>

      {/* Shopify section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ShoppingBag size={16} className="text-[#96bf48]" />
          <h2 className="text-sm font-semibold text-slate-700">Shopify</h2>
          <Badge variant="outline" className="text-xs text-slate-400">
            {isLoading ? '...' : `${stores.filter(s => s.is_active).length} conectada${stores.filter(s => s.is_active).length !== 1 ? 's' : ''}`}
          </Badge>
        </div>

        <div className="space-y-3">
          {CONFIGURED_SHOPS.map(cfg => {
            const connected = stores.find(s => s.shop === cfg.shop && s.is_active)
            return (
              <Card key={cfg.shop} className="shadow-sm border-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-[#96bf48]/10 flex items-center justify-center">
                        <ShoppingBag size={17} className="text-[#96bf48]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{cfg.displayName}</p>
                        <p className="text-xs text-slate-400 font-mono">{cfg.customDomain}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
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
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7"
                              onClick={() => connectShop(cfg.shop)}
                            >
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
                            <Button
                              size="sm"
                              className="text-white text-xs h-7"
                              style={{ backgroundColor: '#96bf48' }}
                              onClick={() => connectShop(cfg.shop)}
                            >
                              <Plug size={11} className="mr-1" /> Conectar
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {connected && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-400">
                      <span>
                        Conectada el{' '}
                        {new Date(connected.installed_at).toLocaleDateString('es-AR', {
                          day: 'numeric', month: 'long', year: 'numeric'
                        })}
                      </span>
                      <a
                        href={`https://${cfg.customDomain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-500 hover:text-blue-700"
                      >
                        <ExternalLink size={10} /> Ver tienda
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Card className="shadow-sm border-slate-100 bg-slate-50">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-600 mb-1">Cómo funciona</p>
            <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
              <li>Al conectar una tienda, se instala un webhook automáticamente en Shopify</li>
              <li>Cada orden pagada se refleja en tiempo real en la sección Financiero</li>
              <li>Los ingresos Shopify aparecen con badge verde para distinguirlos de los manuales</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

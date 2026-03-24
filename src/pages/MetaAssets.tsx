import { useState } from 'react'
import { BarChart3, TrendingUp, DollarSign, MousePointer, Eye, ShoppingCart, RefreshCw, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { WaAccountTable } from '@/components/meta/WaAccountTable'
import { useMetaStats } from '@/hooks/useMetaStats'
import { toast } from 'sonner'

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null) return '—'
  return n.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtInt(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('es-AR')
}

export default function MetaAssets() {
  const { accountStats, campaignStats, adsetStats, isLoading, refresh, summary } = useMetaStats(30)
  const [syncing, setSyncing] = useState(false)
  const [activeTab, setActiveTab] = useState<'numbers' | 'campaigns' | 'adsets'>('numbers')

  async function syncMeta() {
    setSyncing(true)
    try {
      const res = await fetch('/api/meta-sync?days=30')
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Error al sincronizar')
        return
      }
      toast.success(`Sincronizado: ${data.synced.accountDays} dias, ${data.synced.campaignDays} campañas, ${data.synced.adsetDays} adsets`)
      refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSyncing(false)
    }
  }

  // Group campaigns by name (aggregate days)
  const campaignAgg = Object.values(
    campaignStats.reduce((acc, c) => {
      if (!acc[c.campaign_id]) {
        acc[c.campaign_id] = { ...c, spend: 0, impressions: 0, clicks: 0, purchases: 0, purchase_value: 0 }
      }
      acc[c.campaign_id].spend += Number(c.spend)
      acc[c.campaign_id].impressions += Number(c.impressions)
      acc[c.campaign_id].clicks += Number(c.clicks)
      acc[c.campaign_id].purchases += Number(c.purchases)
      acc[c.campaign_id].purchase_value += Number(c.purchase_value)
      return acc
    }, {} as Record<string, any>)
  ).sort((a: any, b: any) => b.spend - a.spend) as any[]

  // Group adsets by name
  const adsetAgg = Object.values(
    adsetStats.reduce((acc, a) => {
      if (!acc[a.adset_id]) {
        acc[a.adset_id] = { ...a, spend: 0, impressions: 0, clicks: 0, purchases: 0, purchase_value: 0 }
      }
      acc[a.adset_id].spend += Number(a.spend)
      acc[a.adset_id].impressions += Number(a.impressions)
      acc[a.adset_id].clicks += Number(a.clicks)
      acc[a.adset_id].purchases += Number(a.purchases)
      acc[a.adset_id].purchase_value += Number(a.purchase_value)
      return acc
    }, {} as Record<string, any>)
  ).sort((a: any, b: any) => b.spend - a.spend) as any[]

  // Daily spend for last 7 days
  const last7 = accountStats
    .filter(s => s.stat_date >= new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])
    .reduce((acc, s) => {
      acc[s.stat_date] = (acc[s.stat_date] || 0) + Number(s.spend)
      return acc
    }, {} as Record<string, number>)

  const tabs = [
    { key: 'numbers' as const, label: 'Numeros WA' },
    { key: 'campaigns' as const, label: `Campañas (${campaignAgg.length})` },
    { key: 'adsets' as const, label: `Adsets (${adsetAgg.length})` },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Activos Meta</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Numeros WA, campañas y rendimiento de Meta Ads
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-8"
          disabled={syncing}
          onClick={syncMeta}
        >
          {syncing ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <RefreshCw size={13} className="mr-1.5" />}
          Sync Meta Ads
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <DollarSign size={12} /> Gasto hoy
            </div>
            <p className="text-lg font-bold text-slate-800">${fmt(summary.spendToday)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <DollarSign size={12} /> Gasto 30d
            </div>
            <p className="text-lg font-bold text-slate-800">${fmt(summary.spendTotal)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <Eye size={12} /> Impresiones
            </div>
            <p className="text-lg font-bold text-slate-800">{fmtInt(summary.impressionsTotal)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <MousePointer size={12} /> CPC
            </div>
            <p className="text-lg font-bold text-slate-800">${fmt(summary.avgCpc)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <ShoppingCart size={12} /> Costo/compra
            </div>
            <p className="text-lg font-bold text-slate-800">${fmt(summary.avgCostPerPurchase)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <TrendingUp size={12} /> ROAS Meta
            </div>
            <p className={`text-lg font-bold ${summary.metaRoas && summary.metaRoas >= 2 ? 'text-green-600' : summary.metaRoas ? 'text-amber-600' : 'text-slate-800'}`}>
              {summary.metaRoas ? `${fmt(summary.metaRoas)}x` : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily spend mini bar */}
      {Object.keys(last7).length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-600 mb-2">Gasto diario (ultimos 7 dias)</p>
            <div className="flex items-end gap-1 h-16">
              {Object.entries(last7).sort(([a], [b]) => a.localeCompare(b)).map(([date, spend]) => {
                const maxSpend = Math.max(...Object.values(last7))
                const pct = maxSpend > 0 ? (spend / maxSpend) * 100 : 0
                return (
                  <div key={date} className="flex-1 flex flex-col items-center gap-0.5">
                    <div
                      className="w-full bg-blue-500 rounded-t"
                      style={{ height: `${Math.max(pct, 4)}%` }}
                      title={`${date}: $${spend.toFixed(2)}`}
                    />
                    <span className="text-[9px] text-slate-400">{date.slice(5)}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1" role="group">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === t.key
                ? 'text-white'
                : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50'
            }`}
            style={activeTab === t.key ? { backgroundColor: '#0B1A2E' } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'numbers' && <WaAccountTable />}

      {activeTab === 'campaigns' && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500">
                <th className="text-left p-3 font-medium">Campaña</th>
                <th className="text-right p-3 font-medium">Gasto</th>
                <th className="text-right p-3 font-medium">Impresiones</th>
                <th className="text-right p-3 font-medium">Clicks</th>
                <th className="text-right p-3 font-medium">CPC</th>
                <th className="text-right p-3 font-medium">Compras</th>
                <th className="text-right p-3 font-medium">$/compra</th>
              </tr>
            </thead>
            <tbody>
              {campaignAgg.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400 text-sm">Sin datos — click "Sync Meta Ads"</td></tr>
              ) : campaignAgg.map((c: any) => (
                <tr key={c.campaign_id} className="border-t border-slate-100 hover:bg-slate-50/50 text-sm">
                  <td className="p-3 font-medium text-slate-800 max-w-[250px] truncate">{c.campaign_name || c.campaign_id}</td>
                  <td className="p-3 text-right font-mono">${fmt(c.spend)}</td>
                  <td className="p-3 text-right text-slate-500">{fmtInt(c.impressions)}</td>
                  <td className="p-3 text-right text-slate-500">{fmtInt(c.clicks)}</td>
                  <td className="p-3 text-right font-mono">${c.clicks > 0 ? fmt(c.spend / c.clicks) : '—'}</td>
                  <td className="p-3 text-right">
                    {c.purchases > 0 ? (
                      <Badge variant="outline" className="text-xs border-green-200 text-green-700 bg-green-50">{c.purchases}</Badge>
                    ) : '—'}
                  </td>
                  <td className="p-3 text-right font-mono">{c.purchases > 0 ? `$${fmt(c.spend / c.purchases)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'adsets' && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500">
                <th className="text-left p-3 font-medium">Ad Set</th>
                <th className="text-right p-3 font-medium">Gasto</th>
                <th className="text-right p-3 font-medium">Impresiones</th>
                <th className="text-right p-3 font-medium">Clicks</th>
                <th className="text-right p-3 font-medium">CPC</th>
                <th className="text-right p-3 font-medium">Compras</th>
                <th className="text-right p-3 font-medium">$/compra</th>
              </tr>
            </thead>
            <tbody>
              {adsetAgg.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400 text-sm">Sin datos — click "Sync Meta Ads"</td></tr>
              ) : adsetAgg.map((a: any) => (
                <tr key={a.adset_id} className="border-t border-slate-100 hover:bg-slate-50/50 text-sm">
                  <td className="p-3 font-medium text-slate-800 max-w-[250px] truncate">{a.adset_name || a.adset_id}</td>
                  <td className="p-3 text-right font-mono">${fmt(a.spend)}</td>
                  <td className="p-3 text-right text-slate-500">{fmtInt(a.impressions)}</td>
                  <td className="p-3 text-right text-slate-500">{fmtInt(a.clicks)}</td>
                  <td className="p-3 text-right font-mono">${a.clicks > 0 ? fmt(a.spend / a.clicks) : '—'}</td>
                  <td className="p-3 text-right">
                    {a.purchases > 0 ? (
                      <Badge variant="outline" className="text-xs border-green-200 text-green-700 bg-green-50">{a.purchases}</Badge>
                    ) : '—'}
                  </td>
                  <td className="p-3 text-right font-mono">{a.purchases > 0 ? `$${fmt(a.spend / a.purchases)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

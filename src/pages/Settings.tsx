import { useState, useEffect } from 'react'
import { Settings2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useSettings } from '@/hooks/useSettings'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency } from '@/lib/formatters'
import { toast } from 'sonner'

export default function Settings() {
  const { monthlyTarget, isLoading, saveMonthlyTarget } = useSettings()
  const { profile } = useAuth()
  const [inputValue, setInputValue] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isLoading) setInputValue(String(monthlyTarget))
  }, [isLoading, monthlyTarget])

  const isAdmin = profile?.role === 'admin'

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(inputValue)
    if (!amount || amount <= 0) { toast.error('Ingresá un monto válido'); return }
    setIsSaving(true)
    const { error } = await saveMonthlyTarget(amount)
    setIsSaving(false)
    if (error) {
      if (error.includes('relation') || error.includes('does not exist')) {
        toast.error('Tabla "settings" no encontrada. Ejecutá el SQL de migración en Supabase.')
      } else {
        toast.error(error)
      }
      return
    }
    toast.success(`Meta mensual actualizada a ${formatCurrency(amount)}`)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Configuración</h1>
        <p className="text-sm text-slate-500 mt-0.5">Parámetros globales del negocio</p>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Settings2 size={16} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700">Metas financieras</h2>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Meta de facturación mensual (USD)</Label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    className="pl-7"
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    disabled={!isAdmin || isLoading}
                    placeholder="5000"
                  />
                </div>
                {isAdmin && (
                  <Button
                    type="submit"
                    className="text-white shrink-0"
                    style={{ backgroundColor: '#10B981' }}
                    disabled={isSaving || isLoading}
                  >
                    {isSaving ? 'Guardando...' : 'Guardar'}
                  </Button>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Actualmente: <span className="font-semibold text-slate-600">{formatCurrency(monthlyTarget)}</span> / mes
                {' · '}
                Aparece en el Dashboard como barra de progreso mensual
              </p>
              {!isAdmin && (
                <p className="text-xs text-amber-600">Solo los administradores pueden modificar esta configuración.</p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-100 bg-slate-50">
        <CardContent className="p-4">
          <p className="text-xs text-slate-500 font-medium mb-1">Nota de migración</p>
          <p className="text-xs text-slate-400">
            Si la meta no se guarda, ejecutá este SQL en Supabase SQL Editor:
          </p>
          <pre className="mt-2 text-[11px] bg-white border border-slate-200 rounded-md p-3 text-slate-600 overflow-x-auto">{`CREATE TABLE IF NOT EXISTS public.settings (
  id         text PRIMARY KEY,
  value      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_select" ON public.settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_upsert" ON public.settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);`}</pre>
        </CardContent>
      </Card>
    </div>
  )
}

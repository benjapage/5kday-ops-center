import { WaAccountTable } from '@/components/meta/WaAccountTable'

export default function MetaAssets() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Activos Meta</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Gestión de cuentas WhatsApp, calentamiento y vinculación con BM
        </p>
      </div>
      <WaAccountTable />
    </div>
  )
}

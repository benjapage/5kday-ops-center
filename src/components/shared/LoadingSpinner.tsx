export function LoadingSpinner({ fullScreen = false }: { fullScreen?: boolean }) {
  const spinner = (
    <div className="flex items-center justify-center gap-3">
      <div
        className="h-6 w-6 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: '#10B981', borderTopColor: 'transparent' }}
      />
      <span className="text-sm text-slate-500">Cargando...</span>
    </div>
  )

  if (fullScreen) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#F8FAFC' }}
      >
        {spinner}
      </div>
    )
  }

  return <div className="py-12">{spinner}</div>
}

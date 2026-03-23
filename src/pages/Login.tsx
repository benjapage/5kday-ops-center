import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const { error } = await signIn(email, password)
    if (error) {
      if (error.toLowerCase().includes('email not confirmed')) {
        setError('Email no confirmado. Revisa tu bandeja de entrada y hace clic en el link de confirmacion.')
      } else {
        setError('Credenciales invalidas. Verifica tu email y contrasena.')
      }
      setIsLoading(false)
      return
    }

    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      <div className="w-full max-w-sm px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl mb-4" style={{ backgroundColor: '#0B1A2E' }}>
            <span className="text-white font-bold text-lg">5K</span>
          </div>
          <h1 className="text-xl font-bold text-slate-800">5Kday OPS CENTER</h1>
          <p className="text-slate-400 text-sm mt-1">Inicia sesion para continuar</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4" aria-label="Formulario de inicio de sesion">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-slate-600">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-slate-600">Contrasena</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 p-3">
                <p id="login-error" role="alert" className="text-xs text-red-600">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full text-white font-semibold"
              style={{ backgroundColor: '#10B981' }}
              disabled={isLoading}
            >
              {isLoading ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

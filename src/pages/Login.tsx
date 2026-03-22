import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

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
        setError('Email no confirmado. Revisá tu bandeja de entrada y hacé clic en el link de confirmación.')
      } else {
        setError('Credenciales inválidas. Verificá tu email y contraseña.')
      }
      setIsLoading(false)
      return
    }

    navigate('/dashboard')
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: '#0B1A2E' }}
    >
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <Logo size="lg" />
          <p className="text-slate-400 text-sm mt-2">OPS CENTER</p>
        </div>

        <Card className="shadow-2xl border-0">
          <CardHeader className="pb-2">
            <h1 className="text-xl font-semibold text-center">Iniciar sesión</h1>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <p className="text-sm text-red-500 text-center">{error}</p>
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

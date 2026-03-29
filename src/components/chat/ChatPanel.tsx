import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, Loader2, Bot, User, Trash2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatPanelProps {
  open: boolean
  onClose: () => void
  userName: string
}

export function ChatPanel({ open, onClose, userName }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200)
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading) return

    const updated: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(updated)
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/external/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated }),
      })
      const json = await res.json()
      if (json.success && json.data?.content) {
        setMessages([...updated, { role: 'assistant', content: json.data.content }])
      } else {
        setMessages([...updated, { role: 'assistant', content: `Error: ${json.error || 'No response'}` }])
      }
    } catch {
      setMessages([...updated, { role: 'assistant', content: 'Error de conexion. Intenta de nuevo.' }])
    } finally {
      setIsLoading(false)
    }
  }, [input, messages, isLoading])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop on mobile */}
      <div className="fixed inset-0 bg-black/40 z-50 md:hidden" onClick={onClose} />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-screen z-50 flex flex-col transition-transform duration-300
          w-full md:w-[400px] ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ backgroundColor: '#0d1b2a' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#10B981' }}>
              <Bot size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Asistente 5Kday</p>
              <p className="text-[10px] text-slate-400">Claude Sonnet</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Limpiar chat"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(16,185,129,0.15)' }}>
                <Bot size={24} style={{ color: '#10B981' }} />
              </div>
              <p className="text-sm font-medium text-white mb-1">Hola {userName}!</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tengo acceso a todos los datos del Ops Center en tiempo real.
                Preguntame sobre campanas, ROAS, numeros de WA, tareas o lo que necesites.
              </p>
              <div className="mt-4 space-y-2 w-full">
                {[
                  'Como van las campanas hoy?',
                  'Que numeros de WA estan calentando?',
                  'Dame un resumen del mes',
                ].map(q => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50) }}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 hover:border-emerald-500/30 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : ''}`}>
              {m.role === 'assistant' && (
                <div className="w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center mt-0.5" style={{ backgroundColor: '#10B981' }}>
                  <Bot size={12} className="text-white" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white/5 text-slate-200'
                }`}
              >
                {m.role === 'assistant' ? (
                  <div className="chat-markdown prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  m.content
                )}
              </div>
              {m.role === 'user' && (
                <div className="w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center mt-0.5 bg-slate-600">
                  <User size={12} className="text-white" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: '#10B981' }}>
                <Bot size={12} className="text-white" />
              </div>
              <div className="bg-white/5 rounded-xl px-3 py-2">
                <Loader2 size={14} className="text-emerald-400 animate-spin" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-white/10 p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Preguntale algo..."
              rows={1}
              className="flex-1 resize-none rounded-xl px-3 py-2 text-sm bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
              style={{ maxHeight: '100px' }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="h-9 w-9 rounded-xl flex items-center justify-center transition-colors disabled:opacity-30"
              style={{ backgroundColor: '#10B981' }}
            >
              <Send size={14} className="text-white" />
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5 text-center">20 mensajes/hora max</p>
        </div>
      </div>
    </>
  )
}

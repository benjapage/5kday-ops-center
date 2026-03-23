export const STATUS_COLORS = {
  cold: '#94A3B8',
  warming: '#F59E0B',
  ready: '#22C55E',
  active: '#22C55E',
  banned: '#EF4444',
} as const

export const WA_WARMING_DAYS = 7

export const EXPENSE_CATEGORIES = [
  { value: 'ad_spend', label: 'Gasto en Ads' },
  { value: 'platform_fees', label: 'Comisiones de plataforma' },
  { value: 'tools_software', label: 'Herramientas / Software' },
  { value: 'team_salaries', label: 'Sueldos del equipo' },
  { value: 'creative_production', label: 'Producción de creativos' },
  { value: 'other', label: 'Otros' },
] as const

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]['value']

export const ROLES = ['admin', 'tech', 'editor'] as const
export type Role = typeof ROLES[number]

export const CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'both', label: 'Ambos' },
] as const

export const ASSET_TYPES = [
  { value: 'image', label: 'Imagen' },
  { value: 'video', label: 'Video' },
  { value: 'copy', label: 'Copy' },
  { value: 'other', label: 'Otro' },
] as const

export const COUNTRIES = [
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'MX', name: 'México', flag: '🇲🇽' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'PE', name: 'Perú', flag: '🇵🇪' },
  { code: 'UY', name: 'Uruguay', flag: '🇺🇾' },
  { code: 'BR', name: 'Brasil', flag: '🇧🇷' },
  { code: 'ES', name: 'España', flag: '🇪🇸' },
  { code: 'US', name: 'Estados Unidos', flag: '🇺🇸' },
  { code: 'OTHER', name: 'Otro', flag: '🌍' },
] as const

interface LogoProps {
  size?: 'sm' | 'lg'
}

export function Logo({ size = 'sm' }: LogoProps) {
  const textSize = size === 'lg' ? 'text-3xl' : 'text-xl'

  return (
    <span className={`font-bold ${textSize} tracking-tight select-none`}>
      <span style={{ color: '#FFFFFF' }}>5K</span>
      <span style={{ color: '#10B981' }}>day</span>
    </span>
  )
}

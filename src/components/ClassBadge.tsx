import type { Classification } from '../types'
import { CLASS_META } from '../ui/classifications'

interface Props {
  classification: Classification
  size?: number
  className?: string
}

export function ClassBadge({ classification, size = 18, className = '' }: Props) {
  const meta = CLASS_META[classification]
  return (
    <span
      role="img"
      aria-label={meta.label}
      title={meta.label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold leading-none text-white ${className}`}
      style={{
        width: size,
        height: size,
        background: meta.color,
        fontSize: size * (meta.glyph.length > 1 ? 0.5 : 0.62),
        letterSpacing: '-0.04em',
      }}
    >
      {meta.glyph}
    </span>
  )
}

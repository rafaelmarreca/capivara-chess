import type { LineMove } from '../types'
import { San } from './San'

interface Props {
  line: LineMove[]
  active: number | null // índice do lance em visualização
  onSelect: (index: number) => void
}

/** Sequência de lances em chips, coloridos pelo lado que joga, clicáveis para ver a posição. */
export function LineChips({ line, active, onSelect }: Props) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-1.5" aria-label="Linha sugerida">
      {line.map((m, i) => {
        const showNumber = m.color === 'w' || i === 0
        const isActive = active === i
        return (
          <li key={i} className="flex items-center gap-1">
            {showNumber && (
              <span className="pl-1 text-xs text-foreground-400">
                {m.moveNumber}
                {m.color === 'w' ? '.' : '...'}
              </span>
            )}
            <button
              onClick={() => onSelect(i)}
              aria-pressed={isActive}
              aria-label={`${m.san}, lance das ${m.color === 'w' ? 'brancas' : 'pretas'}`}
              className={`rounded-full px-2.5 py-0.5 text-sm font-semibold outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-focus ${
                m.color === 'w'
                  ? 'bg-[#ECEEF0] text-[#1F242B] ring-1 ring-[#1F242B]/10'
                  : 'bg-[#3A404B] text-[#ECEEF0] ring-1 ring-white/10'
              } ${isActive ? 'ring-2 ring-primary ring-offset-2 ring-offset-content2' : 'hover:ring-primary/60'}`}
            >
              <San san={m.san} />
            </button>
          </li>
        )
      })}
    </ol>
  )
}

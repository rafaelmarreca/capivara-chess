import { useEffect, useRef } from 'react'
import type { AnalyzedMove, Classification, ParsedMove } from '../types'
import { ClassBadge } from './ClassBadge'
import { San } from './San'
import { CLASS_META } from '../ui/classifications'
import { scrollWithinParent } from '../ui/scroll'

const HIGHLIGHT: Classification[] = ['brilliant', 'great', 'inaccuracy', 'mistake', 'miss', 'blunder']

interface Props {
  moves: (ParsedMove | AnalyzedMove)[]
  ply: number
  onSelect: (ply: number) => void
}

/** Lista de lances numa faixa horizontal (celular), como na revisão do chess.com. */
export function MoveStrip({ moves, ply, onSelect }: Props) {
  const activeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (activeRef.current) scrollWithinParent(activeRef.current, 'x')
  }, [ply])

  return (
    <ol aria-label="Lances" className="flex shrink-0 items-center gap-0.5 overflow-x-auto whitespace-nowrap py-0.5 text-sm [scrollbar-width:none]">
      {moves.map((m, i) => {
        const active = m.ply === ply
        const cls = 'classification' in m ? m.classification : undefined
        const number = m.color === 'w' ? `${Math.ceil(m.ply / 2)}.` : i === 0 ? `${Math.ceil(m.ply / 2)}...` : null
        return (
          <li key={m.ply} className="flex items-center">
            {number && <span className="pl-1.5 pr-0.5 text-xs text-foreground-400">{number}</span>}
            <button
              ref={active ? activeRef : undefined}
              onClick={() => onSelect(m.ply)}
              aria-current={active ? 'step' : undefined}
              className={`flex items-center gap-1 rounded-small px-1.5 py-1 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                active ? 'bg-content3' : ''
              }`}
              style={cls && HIGHLIGHT.includes(cls) ? { color: CLASS_META[cls].color } : undefined}
            >
              {cls && active && <ClassBadge classification={cls} size={14} />}
              <San san={m.san} />
            </button>
          </li>
        )
      })}
    </ol>
  )
}

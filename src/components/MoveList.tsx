import { useEffect, useRef } from 'react'
import type { AnalyzedMove, Classification, ParsedMove } from '../types'
import { ClassBadge } from './ClassBadge'
import { San } from './San'
import { CLASS_META } from '../ui/classifications'

const HIGHLIGHT: Classification[] = ['brilliant', 'great', 'inaccuracy', 'mistake', 'miss', 'blunder']

interface Props {
  moves: (ParsedMove | AnalyzedMove)[]
  ply: number
  onSelect: (ply: number) => void
  /** Notas do usuário por ply, mostradas resumidas abaixo do par de lances. */
  notes?: Record<number, string>
}

export function MoveList({ moves, ply, onSelect, notes }: Props) {
  const activeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [ply])

  // Agrupa por número do lance; se a partida começa com as pretas, a 1ª linha só tem o lance preto
  const offset = moves[0]?.color === 'b' ? 1 : 0
  const rows: (ParsedMove | AnalyzedMove)[][] = []
  moves.forEach((m, i) => {
    const r = Math.floor((i + offset) / 2)
    ;(rows[r] ??= []).push(m)
  })

  return (
    <ol className="flex flex-col text-[0.9375rem]">
      {rows.map((pair, r) => (
        // Linhas alternadas agrupam o par branco/preto sem precisar de bordas
        <li key={r} className="grid grid-cols-[2.5rem_1fr_1fr] items-center rounded-small even:bg-content2/60">
          <span className="pr-2 text-right text-xs text-foreground-400">{r + 1}</span>
          {pair[0]?.color === 'b' && <span />}
          {pair.map((m) => {
            const active = m.ply === ply
            const cls = 'classification' in m ? m.classification : undefined
            return (
              <button
                key={m.ply}
                ref={active ? activeRef : undefined}
                onClick={() => onSelect(m.ply)}
                aria-current={active ? 'step' : undefined}
                className={`my-0.5 flex items-center gap-2 rounded-small px-2 py-1 text-left font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus ${
                  active ? 'bg-content3' : 'hover:bg-content3/60'
                }`}
                // Lances marcantes ganham a cor da classificação, como na revisão do chess.com
                style={cls && HIGHLIGHT.includes(cls) ? { color: CLASS_META[cls].color } : undefined}
              >
                {cls ? <ClassBadge classification={cls} size={16} /> : <span className="w-4" />}
                <San san={m.san} />
              </button>
            )
          })}
          {pair
            .filter((m) => notes?.[m.ply]?.trim())
            .map((m) => (
              <button
                key={`nota-${m.ply}`}
                onClick={() => onSelect(m.ply)}
                className="col-start-2 col-end-4 mb-1 line-clamp-1 rounded-small border-l-2 border-default-400 px-2 text-left text-xs text-foreground-500 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
              >
                {notes![m.ply]}
              </button>
            ))}
        </li>
      ))}
    </ol>
  )
}

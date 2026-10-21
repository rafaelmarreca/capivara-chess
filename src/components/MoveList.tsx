import { useEffect, useRef } from 'react'
import type { AnalyzedMove, ParsedMove } from '../types'
import { ClassBadge } from './ClassBadge'
import { San } from './San'

interface Props {
  moves: (ParsedMove | AnalyzedMove)[]
  ply: number
  onSelect: (ply: number) => void
}

export function MoveList({ moves, ply, onSelect }: Props) {
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
    <ol className="grid grid-cols-[2.5rem_1fr_1fr] gap-y-0.5 text-sm">
      {rows.map((pair, r) => (
        <li key={r} className="contents">
          <span className="py-1.5 pl-1 text-foreground-400">{r + 1}.</span>
          {pair[0]?.color === 'b' && <span />}
          {pair.map((m) => {
            const active = m.ply === ply
            return (
              <button
                key={m.ply}
                ref={active ? activeRef : undefined}
                onClick={() => onSelect(m.ply)}
                className={`flex items-center gap-1.5 rounded-small px-2 py-1.5 text-left font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus ${
                  active ? 'bg-content3' : 'hover:bg-content2'
                }`}
              >
                {'classification' in m ? <ClassBadge classification={m.classification} size={16} /> : <span className="w-4" />}
                <San san={m.san} />
              </button>
            )
          })}
        </li>
      ))}
    </ol>
  )
}

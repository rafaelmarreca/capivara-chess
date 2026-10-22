import { Chessboard } from 'react-chessboard'
import type { AnalyzedMove, LineMove } from '../types'
import type { Arrow } from '../analysis/positional'
import { CLASS_META } from '../ui/classifications'
import { ClassBadge } from './ClassBadge'

interface Props {
  fen: string
  move?: AnalyzedMove // lance que levou à posição exibida
  orientation: 'white' | 'black'
  preview?: LineMove // lance da linha sugerida em visualização
  hints?: Arrow[] // setas da explicação do lance
}

const PREVIEW_COLOR = '#7C9CBF'

const BEST_ARROW = 'rgba(127, 178, 74, 0.85)'
// Laranja, como as setas do comentário no chess.com
const HINT_ARROW = 'rgba(232, 150, 40, 0.85)'

export function BoardView({ fen, move, orientation, preview, hints = [] }: Props) {
  const color = preview ? PREVIEW_COLOR : move ? CLASS_META[move.classification].color : undefined
  const marked = preview ?? move
  const showBest =
    !preview &&
    move?.bestMoveUci &&
    move.bestMoveUci !== move.uci &&
    !['book', 'best', 'brilliant', 'great', 'forced'].includes(move.classification)

  const arrows = showBest
    ? [{ startSquare: move.bestMoveUci!.slice(0, 2), endSquare: move.bestMoveUci!.slice(2, 4), color: BEST_ARROW }]
    : []
  if (!preview) {
    for (const h of hints) {
      const dup = arrows.some((a) => a.startSquare === h.from && a.endSquare === h.to)
      if (!dup && h.from !== h.to) arrows.push({ startSquare: h.from, endSquare: h.to, color: HINT_ARROW })
    }
  }

  return (
    <div className="aspect-square w-full overflow-visible rounded-medium">
      <Chessboard
        options={{
          id: 'review-board',
          position: fen,
          boardOrientation: orientation,
          allowDragging: false,
          allowDrawingArrows: false,
          arrows,
          animationDurationInMs: 160,
          lightSquareStyle: { backgroundColor: '#DCE1E6' },
          darkSquareStyle: { backgroundColor: '#8A9BAE' },
          lightSquareNotationStyle: { color: '#8A9BAE', fontWeight: 600 },
          darkSquareNotationStyle: { color: '#DCE1E6', fontWeight: 600 },
          boardStyle: { borderRadius: 10, overflow: 'visible' },
          squareRenderer: ({ square, children }) => {
            const highlighted = marked && (square === marked.from || square === marked.to)
            return (
              <div className="relative h-full w-full">
                {highlighted && (
                  <div className="absolute inset-0" style={{ background: color, opacity: 0.45 }} />
                )}
                <div className="relative h-full w-full">{children}</div>
                {!preview && move && square === move.to && (
                  <ClassBadge
                    classification={move.classification}
                    size={26}
                    className="pointer-events-none absolute -right-2 -top-2 z-10 shadow-md ring-2 ring-white/80"
                  />
                )}
              </div>
            )
          },
        }}
      />
    </div>
  )
}

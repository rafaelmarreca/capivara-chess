import type { AnalyzedMove, Score } from '../types'
import { formatScore } from '../analysis/winPercent'
import { CLASS_META } from '../ui/classifications'
import { ClassBadge } from './ClassBadge'

interface Props {
  move?: AnalyzedMove
  initialEval?: Score
  opening?: string
}

const NO_SUGGESTION = ['book', 'best', 'brilliant', 'great', 'forced']

export function MoveDetail({ move, initialEval, opening }: Props) {
  if (!move) {
    return (
      <div className="rounded-medium bg-content2 p-4">
        <p className="font-medium">Posição inicial</p>
        <p className="mt-1 text-sm text-foreground-500">
          Use as setas do teclado ou clique num lance para navegar.
          {initialEval && ` Avaliação: ${formatScore(initialEval)}.`}
        </p>
      </div>
    )
  }
  const meta = CLASS_META[move.classification]
  const showBest = move.bestMoveSan && !NO_SUGGESTION.includes(move.classification)

  return (
    <div className="rounded-medium bg-content2 p-4">
      <div className="flex items-center gap-3">
        <ClassBadge classification={move.classification} size={28} />
        <p className="flex-1 font-semibold" style={{ color: meta.color }}>
          {meta.phrase.replace('{san}', move.san)}
        </p>
        <span className="rounded-small bg-content3 px-2 py-0.5 text-sm font-semibold">{formatScore(move.evalAfter)}</span>
      </div>
      {move.classification === 'book' && opening && (
        <p className="mt-2 text-sm text-foreground-500">{opening}</p>
      )}
      {showBest && (
        <p className="mt-3 text-sm">
          <span className="text-foreground-500">Melhor era </span>
          <span className="font-semibold" style={{ color: CLASS_META.best.color }}>
            {move.bestMoveSan}
          </span>
          {move.bestLineSan.length > 1 && (
            <span className="text-foreground-500"> — {move.bestLineSan.slice(1, 6).join(' ')}</span>
          )}
        </p>
      )}
    </div>
  )
}

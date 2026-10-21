import type { Score } from '../types'
import { formatScore, winPercentWhite } from '../analysis/winPercent'

interface Props {
  score?: Score
  orientation: 'white' | 'black'
}

export function EvalBar({ score, orientation }: Props) {
  const white = score ? winPercentWhite(score) : 50
  const whiteAhead = white >= 50
  const label = score ? formatScore(score).replace(/^[+-]/, '') : ''
  const whiteAtBottom = orientation === 'white'

  return (
    <div
      className="relative w-6 shrink-0 self-stretch overflow-hidden rounded-small bg-[#3A404B]"
      role="meter"
      aria-label="Avaliação"
      aria-valuenow={Math.round(white)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`absolute inset-x-0 bg-[#ECEEF0] transition-[height] duration-300 ease-out ${whiteAtBottom ? 'bottom-0' : 'top-0'}`}
        style={{ height: `${white}%` }}
      />
      <span
        className={`absolute inset-x-0 text-center text-[10px] font-semibold ${
          whiteAhead === whiteAtBottom ? 'bottom-1' : 'top-1'
        } ${whiteAhead ? 'text-[#3A404B]' : 'text-[#ECEEF0]'}`}
      >
        {label}
      </span>
    </div>
  )
}

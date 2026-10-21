import type { Color, Score } from '../types'

const MATE_CP = 10000
/** Valor usado para posições já terminadas em xeque-mate. */
export const CHECKMATE_CP = 100000

/** Converte uma avaliação em centipeões (mate vira um valor grande). */
export function scoreToCp(score: Score): number {
  if (score.mate != null) {
    if (score.mate === 0) return 0
    return score.mate > 0 ? MATE_CP - score.mate : -MATE_CP - score.mate
  }
  return score.cp ?? 0
}

/** Probabilidade de vitória (0–100) para as brancas — fórmula do lichess. */
export function winPercentWhite(score: Score): number {
  if (score.mate != null && score.mate !== 0) return score.mate > 0 ? 100 : 0
  if (score.cp != null && Math.abs(score.cp) >= CHECKMATE_CP) return score.cp > 0 ? 100 : 0
  const cp = Math.max(-1000, Math.min(1000, scoreToCp(score)))
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1)
}

export function winPercentFor(score: Score, color: Color): number {
  const w = winPercentWhite(score)
  return color === 'w' ? w : 100 - w
}

export function formatScore(score: Score): string {
  if (score.mate != null) return score.mate === 0 ? '#' : `${score.mate > 0 ? '' : '-'}M${Math.abs(score.mate)}`
  if (score.cp != null && Math.abs(score.cp) >= CHECKMATE_CP) return score.cp > 0 ? '1-0' : '0-1'
  const v = (score.cp ?? 0) / 100
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}`
}

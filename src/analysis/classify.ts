import type { Classification } from '../types'

export const THRESHOLDS = {
  excellent: 2,
  good: 5,
  inaccuracy: 10,
  mistake: 20,
  /** Diferença mínima entre o 1º e o 2º melhor lance para ser "Ótimo". */
  onlyMoveGap: 10,
  /** Perda máxima para um sacrifício ainda ser "Brilhante". */
  brilliantMaxLoss: 2,
  /** Acima disso a posição já está ganha e não há brilhante. */
  brilliantMaxWinBefore: 97,
  brilliantMinWinAfter: 50,
  missMinLoss: 10,
  missMinWinAfter: 40,
}

export interface ClassifyInput {
  isBook: boolean
  legalMoves: number
  isBest: boolean
  isSacrifice: boolean
  winBefore: number // melhor resultado possível, do ponto de vista de quem joga
  winAfter: number
  secondBestWin?: number // win% do 2º melhor lance, se houver
  /** O melhor lance leva a mate forçado e o 2º melhor não. */
  mateOnlyViaBest?: boolean
  previousOpponent?: Classification
}

export function classifyMove(i: ClassifyInput): Classification {
  const t = THRESHOLDS
  const loss = Math.max(0, i.winBefore - i.winAfter)

  // Lance de teoria, desde que não seja um erro claro (algumas linhas catalogadas são armadilhas)
  if (i.isBook && loss < t.good) return 'book'
  if (i.legalMoves === 1) return 'forced'

  if (
    i.isSacrifice &&
    loss <= t.brilliantMaxLoss &&
    (i.winBefore < t.brilliantMaxWinBefore || i.mateOnlyViaBest) &&
    i.winAfter >= t.brilliantMinWinAfter
  ) {
    return 'brilliant'
  }

  if (i.isBest) {
    if (i.secondBestWin != null && i.winBefore - i.secondBestWin >= t.onlyMoveGap) return 'great'
    return 'best'
  }

  const opponentErred = i.previousOpponent === 'mistake' || i.previousOpponent === 'blunder'
  if (opponentErred && loss >= t.missMinLoss && i.winAfter >= t.missMinWinAfter) return 'miss'

  if (loss < t.excellent) return 'excellent'
  if (loss < t.good) return 'good'
  if (loss < t.inaccuracy) return 'inaccuracy'
  if (loss < t.mistake) return 'mistake'
  return 'blunder'
}

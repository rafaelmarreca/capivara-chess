import type { Motif } from './analysis/explain'
import type { BestReason } from './analysis/bestReason'

export type Color = 'w' | 'b'

export interface ParsedMove {
  ply: number // 1-based
  color: Color
  san: string
  uci: string
  from: string
  to: string
  fenBefore: string
  fenAfter: string
  clock?: string
}

export interface ParsedGame {
  pgn: string // texto da partida individual, como foi importado
  headers: Record<string, string>
  startFen: string
  moves: ParsedMove[]
}

/** Avaliação do ponto de vista das brancas. */
export interface Score {
  cp?: number
  mate?: number
}

export interface EngineLine {
  score: Score // ponto de vista das brancas
  pv: string[] // lances em UCI
}

export interface PositionEval {
  fen: string
  depth: number
  lines: EngineLine[] // ordenadas da melhor para a pior
}

export type Classification =
  | 'book'
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder'
  | 'forced'

/** Lance de uma linha sugerida pelo motor, com a posição resultante. */
export interface LineMove {
  san: string
  uci: string
  from: string
  to: string
  color: Color
  moveNumber: number
  fenAfter: string
}

export interface AnalyzedMove extends ParsedMove {
  classification: Classification
  winBefore: number // win% do jogador que moveu, antes do lance
  winAfter: number // win% do jogador que moveu, depois do lance
  loss: number
  accuracy: number
  evalAfter: Score // ponto de vista das brancas
  bestMoveUci?: string
  bestMoveSan?: string
  bestLine: LineMove[] // linha principal do motor a partir da posição antes do lance
  opening?: string
  motifs: Motif[] // o que aconteceu de concreto, confirmado pela linha da engine
  bestReason: BestReason | null // por que o melhor lance era melhor (null se o jogado foi o melhor)
}

export interface PlayerSummary {
  accuracy: number
  counts: Record<Classification, number>
}

export interface GameAnalysis {
  depth: number
  initialEval: Score
  moves: AnalyzedMove[]
  white: PlayerSummary
  black: PlayerSummary
  opening?: { eco: string; name: string }
}

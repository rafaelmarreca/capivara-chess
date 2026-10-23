import { Chess, type PieceSymbol, type Square } from 'chess.js'
import type { Score } from '../types'
import { VALUES } from './sacrifice'
import { materialSwing, mateFor, netLossesAgainst, playedSwing, sanAt, type ExplainInput, type Motif } from './explain'
import { positionalMotifs, type PositionalMotif } from './positional'

/** Por que o melhor lance era melhor que o jogado; uma razão só, a mais forte. */
export type BestReason =
  | { kind: 'mates'; bestSan: string; mateIn: number }
  | { kind: 'avoidsMate'; bestSan: string }
  | { kind: 'saves'; bestSan: string; piece: PieceSymbol }
  | { kind: 'defends'; bestSan: string; piece: PieceSymbol; square: Square }
  | { kind: 'winsMaterial'; bestSan: string; gain: number; piece?: PieceSymbol }
  | { kind: 'positional'; bestSan: string; motif: PositionalMotif }
  | { kind: 'evalDiff'; bestSan: string; best: Score; played: Score }

const MIN_SWING = 2
// Esses motivos do lance jogado já explicam o melhor ("perdeu a chance de capturar…"): não repetir
const ALREADY_EXPLAINED = new Set(['missedMate', 'missedCapture', 'missedFork'])

export function bestReason(input: ExplainInput, motifs: Motif[]): BestReason | null {
  const { fenBefore, fenAfter, uci, color, before, after } = input
  const best = before.lines[0]
  const reply = after.lines[0]
  const bestUci = best?.pv[0]
  if (!best || !reply || !bestUci || bestUci === uci) return null
  if (motifs.some((m) => ALREADY_EXPLAINED.has(m.kind))) return null
  const bestSan = sanAt(fenBefore, bestUci)
  if (!bestSan) return null
  const opp = color === 'w' ? 'b' : 'w'

  const mateIn = mateFor(best.score, color)
  if (mateIn != null) return { kind: 'mates', bestSan, mateIn }
  if (mateFor(reply.score, opp) != null && mateFor(best.score, opp) == null) return { kind: 'avoidsMate', bestSan }

  // A peça que o lance jogado perdeu: o melhor a tirava do lugar ou a defendia?
  const lost = motifs.find((m) => m.kind === 'hangs' || m.kind === 'losesPiece') as { square: Square } | undefined
  if (lost) {
    const pre = new Chess(fenBefore)
    const piece = pre.get(lost.square)
    if (piece?.color === color) {
      if (bestUci.slice(0, 2) === lost.square) return { kind: 'saves', bestSan, piece: piece.type }
      const post = new Chess(fenBefore)
      post.move({ from: bestUci.slice(0, 2), to: bestUci.slice(2, 4), promotion: bestUci[4] })
      if (post.get(lost.square)?.color === color && post.attackers(lost.square, color).length > pre.attackers(lost.square, color).length) {
        return { kind: 'defends', bestSan, piece: piece.type, square: lost.square }
      }
    }
  }

  const swingBest = materialSwing(fenBefore, best.pv, color)
  const swingPlayed = playedSwing(fenBefore, fenAfter, uci, reply.pv, color)
  const gain = Math.min(swingBest, swingBest - swingPlayed)
  if (gain >= MIN_SWING) {
    const won = netLossesAgainst(fenBefore, best.pv, opp)
    const top = won.reduce<(typeof won)[number] | null>((a, c) => (!a || VALUES[c.move.captured!] > VALUES[a.move.captured!] ? c : a), null)
    return { kind: 'winsMaterial', bestSan, gain, piece: top?.move.captured }
  }

  const [positional] = positionalMotifs(fenBefore, bestUci)
  if (positional) return { kind: 'positional', bestSan, motif: positional }

  return { kind: 'evalDiff', bestSan, best: best.score, played: reply.score }
}

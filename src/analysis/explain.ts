import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js'
import type { Classification, PositionEval, Score } from '../types'
import { VALUES } from './sacrifice'

/** O que aconteceu de concreto no lance, confirmado pela linha da engine. */
export type Motif =
  | { kind: 'allowedMate'; mateIn: number; firstSan: string }
  | { kind: 'missedMate'; mateIn: number; bestSan: string }
  | { kind: 'hangs'; piece: PieceSymbol; square: Square; captureSan: string; loss: number; defended: boolean }
  | { kind: 'missedCapture'; piece: PieceSymbol; square: Square; bestSan: string; gain: number }
  | { kind: 'allowedFork'; forkSan: string; targets: PieceSymbol[]; loss: number }
  | { kind: 'missedFork'; forkSan: string; targets: PieceSymbol[]; gain: number }
  | { kind: 'wins'; gain: number; mateIn?: number }

export interface ExplainInput {
  fenBefore: string
  fenAfter: string
  uci: string
  color: Color
  classification: Classification
  before: PositionEval
  after: PositionEval
}

// Até onde seguir a linha da engine: o suficiente para trocas e garfos, sem pegar ganhos que não têm a ver com o lance
const MAX_PLIES = 6
const MIN_SWING = 2
const GOOD: Classification[] = ['brilliant', 'great', 'best', 'excellent']

function play(chess: Chess, uci: string): Move | null {
  try {
    return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
  } catch {
    return null
  }
}

/** Saldo de material para `color` ao jogar `pv` a partir de `fen` (até 6 plies ou o primeiro lance ilegal). */
export function materialSwing(fen: string, pv: string[], color: Color): number {
  const chess = new Chess(fen)
  let swing = 0
  for (const uci of pv.slice(0, MAX_PLIES)) {
    const m = play(chess, uci)
    if (!m) break
    const gain = (m.captured ? VALUES[m.captured] : 0) + (m.promotion ? VALUES[m.promotion] - 1 : 0)
    swing += m.color === color ? gain : -gain
  }
  return swing
}

/** Peças de valor maior que a que acabou de jogar `uci` (ou o rei) atacadas por ela; [] se forem menos de 2. */
export function forkTargets(fen: string, uci: string): PieceSymbol[] {
  const chess = new Chess(fen)
  const m = play(chess, uci)
  if (!m) return []
  const value = VALUES[m.piece]
  const targets: PieceSymbol[] = []
  for (const row of chess.board()) {
    for (const p of row) {
      if (!p || p.color === m.color) continue
      if (p.type !== 'k' && VALUES[p.type] <= value) continue
      if (chess.attackers(p.square, m.color).includes(m.to)) targets.push(p.type)
    }
  }
  return targets.length >= 2 ? targets : []
}

function sanAt(fen: string, uci: string): string | null {
  return play(new Chess(fen), uci)?.san ?? null
}

/** Primeira captura do adversário de `color` na linha, a partir de `fen`. */
function firstCaptureAgainst(fen: string, pv: string[], color: Color) {
  const chess = new Chess(fen)
  for (const uci of pv.slice(0, MAX_PLIES)) {
    const m = play(chess, uci)
    if (!m) return null
    if (m.captured && m.color !== color) return m
  }
  return null
}

const mateFor = (score: Score | undefined, color: Color): number | null =>
  score?.mate != null && (color === 'w' ? score.mate > 0 : score.mate < 0) ? Math.abs(score.mate) : null

/** Motivos do lance, do mais importante para o menos; no máximo 2. Sem confirmação pela linha, nada. */
export function detectMotifs({ fenBefore, fenAfter, uci, color, classification, before, after }: ExplainInput): Motif[] {
  const opp: Color = color === 'w' ? 'b' : 'w'
  const best = before.lines[0]
  const reply = after.lines[0]
  if (!best || !reply) return []
  const bestPv = best.pv
  const replyPv = reply.pv
  const playedBest = bestPv[0] === uci
  const swingBest = materialSwing(fenBefore, bestPv, color)
  const swingPlayed = materialSwing(fenBefore, [uci, ...replyPv], color)
  const motifs: Motif[] = []

  const mateAgainst = mateFor(reply.score, opp)
  const firstSan = replyPv[0] ? sanAt(fenAfter, replyPv[0]) : null
  if (mateAgainst != null && mateFor(best.score, opp) == null && firstSan) {
    motifs.push({ kind: 'allowedMate', mateIn: mateAgainst, firstSan })
  }

  const mateBefore = mateFor(best.score, color)
  const bestSan = bestPv[0] ? sanAt(fenBefore, bestPv[0]) : null
  if (mateBefore != null && !playedBest && mateFor(reply.score, color) == null && bestSan) {
    motifs.push({ kind: 'missedMate', mateIn: mateBefore, bestSan })
  }

  const lost = swingPlayed - swingBest
  if (lost <= -MIN_SWING && replyPv[0]) {
    const fork = forkTargets(fenAfter, replyPv[0])
    if (fork.length && firstSan) {
      motifs.push({ kind: 'allowedFork', forkSan: firstSan, targets: fork, loss: -lost })
    } else {
      const cap = firstCaptureAgainst(fenAfter, replyPv, color)
      if (cap) {
        const defended = new Chess(fenAfter).attackers(cap.to, color).length > 0
        motifs.push({ kind: 'hangs', piece: cap.captured!, square: cap.to, captureSan: cap.san, loss: -lost, defended })
      }
    }
  }

  if (!playedBest && bestSan && -lost >= MIN_SWING) {
    const fork = forkTargets(fenBefore, bestPv[0])
    const capture = new Chess(fenBefore).get(bestPv[0].slice(2, 4) as Square)
    if (fork.length) motifs.push({ kind: 'missedFork', forkSan: bestSan, targets: fork, gain: -lost })
    else if (capture && capture.color === opp) {
      motifs.push({ kind: 'missedCapture', piece: capture.type, square: bestPv[0].slice(2, 4) as Square, bestSan, gain: -lost })
    }
  }

  if (GOOD.includes(classification)) {
    const mate = mateFor(reply.score, color)
    if (mate != null) motifs.push({ kind: 'wins', gain: Math.max(0, swingPlayed), mateIn: mate })
    else if (swingPlayed >= MIN_SWING) motifs.push({ kind: 'wins', gain: swingPlayed })
  }

  return motifs.slice(0, 2)
}

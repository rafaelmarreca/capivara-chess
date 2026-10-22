import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js'
import type { Classification, PositionEval, Score } from '../types'
import { VALUES } from './sacrifice'
import { positionalMotifs, type Arrow, type PositionalMotif } from './positional'

type TacticalMotif =
  | { kind: 'allowedMate'; mateIn: number; firstSan: string }
  | { kind: 'missedMate'; mateIn: number; bestSan: string }
  | { kind: 'hangs'; piece: PieceSymbol; square: Square; captureSan: string; loss: number; defended: boolean }
  | { kind: 'losesPiece'; piece: PieceSymbol; square: Square; firstSan: string; loss: number }
  | { kind: 'missedCapture'; piece: PieceSymbol; square: Square; bestSan: string; gain: number }
  | { kind: 'allowedFork'; forkSan: string; targets: PieceSymbol[]; loss: number }
  | { kind: 'missedFork'; forkSan: string; targets: PieceSymbol[]; gain: number }
  | { kind: 'wins'; gain: number; mateIn?: number }

/** O que aconteceu de concreto no lance (tática confirmada pela linha da engine, ou posicional), com a seta a desenhar. */
export type Motif = (TacticalMotif | PositionalMotif) & { arrow?: Arrow }

export interface ExplainInput {
  fenBefore: string
  fenAfter: string
  uci: string
  color: Color
  classification: Classification
  before: PositionEval
  after: PositionEval
  /** Valor do que o adversário capturou no lance anterior (retomar não é "ganhar"). */
  previousCaptured?: number
}

// Até onde seguir a linha da engine: o suficiente para trocas e garfos, sem pegar ganhos que não têm a ver com o lance.
// Uma troca em andamento no limite é seguida até acabar.
const MAX_PLIES = 6
const MIN_SWING = 2
const GOOD: Classification[] = ['brilliant', 'great', 'best', 'excellent']
// Motivos negativos só onde a classificação concorda que o lance foi ruim
const BAD: Classification[] = ['mistake', 'blunder', 'miss']
// Elogio posicional só onde a classificação não diz que o lance foi impreciso ou pior
const POSITIONAL: Classification[] = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'forced']

function play(chess: Chess, uci: string): Move | null {
  try {
    return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
  } catch {
    return null
  }
}

/** Casa onde estava a peça capturada (no en passant, não é a casa de chegada). */
export function capturedSquare(m: Move): Square {
  return m.flags.includes('e') ? ((m.to[0] + m.from[1]) as Square) : m.to
}

/**
 * Joga a linha a partir de `fen`, até 6 plies ou o primeiro lance ilegal. No limite, segue
 * enquanto o lance for captura ou promoção, ou o próximo retomar na mesma casa (troca em andamento).
 */
function walk(fen: string, pv: string[], visit: (m: Move, ply: number) => void): void {
  const chess = new Chess(fen)
  for (let i = 0; i < pv.length; i++) {
    const m = play(chess, pv[i])
    if (!m) return
    visit(m, i)
    if (i + 1 >= MAX_PLIES && !m.captured && !m.promotion && pv[i + 1]?.slice(2, 4) !== m.to) return
  }
}

/** Saldo de material para `color` ao jogar `pv` a partir de `fen`. */
export function materialSwing(fen: string, pv: string[], color: Color): number {
  let swing = 0
  walk(fen, pv, (m) => {
    const gain = (m.captured ? VALUES[m.captured] : 0) + (m.promotion ? VALUES[m.promotion] - 1 : 0)
    swing += m.color === color ? gain : -gain
  })
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

/**
 * Capturas do adversário de `color` na linha que não foram compensadas: cada captura de `color`
 * anula a captura adversária mais valiosa ainda aberta que não valha mais que ela (troca).
 */
function netLossesAgainst(fen: string, pv: string[], color: Color): { move: Move; ply: number }[] {
  const open: { move: Move; ply: number }[] = []
  walk(fen, pv, (m, ply) => {
    if (!m.captured) return
    if (m.color !== color) return void open.push({ move: m, ply })
    const v = VALUES[m.captured]
    let pick = -1
    open.forEach((c, i) => {
      const cv = VALUES[c.move.captured!]
      if (cv <= v && (pick < 0 || cv > VALUES[open[pick].move.captured!])) pick = i
    })
    if (pick >= 0) open.splice(pick, 1)
  })
  return open
}

const arrowOf = (m: Move | null | undefined): Arrow | undefined => (m ? { from: m.from, to: m.to } : undefined)
const moveAt = (fen: string, uci: string | undefined) => (uci ? play(new Chess(fen), uci) : null)

const mateFor = (score: Score | undefined, color: Color): number | null =>
  score?.mate != null && (color === 'w' ? score.mate > 0 : score.mate < 0) ? Math.abs(score.mate) : null

/** Motivos do lance, do mais importante para o menos; no máximo 2. Sem confirmação pela linha, nada. */
export function detectMotifs({
  fenBefore,
  fenAfter,
  uci,
  color,
  classification,
  before,
  after,
  previousCaptured = 0,
}: ExplainInput): Motif[] {
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
  const bad = BAD.includes(classification)

  const mateAgainst = mateFor(reply.score, opp)
  const firstSan = replyPv[0] ? sanAt(fenAfter, replyPv[0]) : null
  const replyArrow = arrowOf(moveAt(fenAfter, replyPv[0]))
  if (bad && mateAgainst != null && mateFor(best.score, opp) == null && firstSan) {
    motifs.push({ kind: 'allowedMate', mateIn: mateAgainst, firstSan, arrow: replyArrow })
  }

  const mateBefore = mateFor(best.score, color)
  const bestSan = bestPv[0] ? sanAt(fenBefore, bestPv[0]) : null
  if (bad && mateBefore != null && !playedBest && mateFor(reply.score, color) == null && bestSan) {
    motifs.push({ kind: 'missedMate', mateIn: mateBefore, bestSan })
  }

  // Perda de fato (saldo real negativo) e pior que a melhor linha; o número dito é o menor dos dois
  const lost = Math.min(-swingPlayed, swingBest - swingPlayed)
  if (bad && lost >= MIN_SWING && replyPv[0]) {
    const fork = forkTargets(fenAfter, replyPv[0])
    if (fork.length && firstSan) {
      motifs.push({ kind: 'allowedFork', forkSan: firstSan, targets: fork, loss: lost, arrow: replyArrow })
    } else {
      // A peça que importa é a mais valiosa perdida e não recuperada, não a primeira capturada
      // (Qxg2 importa pela torre em h1; numa troca de damas antes, a dama não é a perda)
      const caps = netLossesAgainst(fenAfter, replyPv, color)
      const worst = caps.reduce<(typeof caps)[number] | null>(
        (a, c) => (!a || VALUES[c.move.captured!] > VALUES[a.move.captured!] ? c : a),
        null,
      )
      if (worst && worst.ply === 0) {
        const cap = worst.move
        const square = capturedSquare(cap)
        const defended = new Chess(fenAfter).attackers(square, color).length > 0
        motifs.push({ kind: 'hangs', piece: cap.captured!, square, captureSan: cap.san, loss: lost, defended, arrow: { from: cap.from, to: square } })
      } else if (worst && firstSan) {
        const square = capturedSquare(worst.move)
        motifs.push({ kind: 'losesPiece', piece: worst.move.captured!, square, firstSan, loss: lost, arrow: { from: worst.move.from, to: square } })
      }
    }
  }

  // Ganho que a melhor linha teria de fato, e que o lance jogado não teve
  const missed = Math.min(swingBest, swingBest - swingPlayed)
  if (bad && !playedBest && bestSan && missed >= MIN_SWING) {
    const fork = forkTargets(fenBefore, bestPv[0])
    const capture = new Chess(fenBefore).get(bestPv[0].slice(2, 4) as Square)
    if (fork.length) motifs.push({ kind: 'missedFork', forkSan: bestSan, targets: fork, gain: missed })
    else if (capture && capture.color === opp) {
      motifs.push({ kind: 'missedCapture', piece: capture.type, square: bestPv[0].slice(2, 4) as Square, bestSan, gain: missed })
    }
  }

  // Material "ganho" numa linha que leva a mate contra não é ganho
  if (GOOD.includes(classification) && mateAgainst == null) {
    const mate = mateFor(reply.score, color)
    const captures = new Chess(fenBefore).get(uci.slice(2, 4) as Square)?.color === opp
    const won = swingPlayed - previousCaptured
    if (mate != null) motifs.push({ kind: 'wins', gain: Math.max(0, won), mateIn: mate })
    else if (captures && won >= MIN_SWING) motifs.push({ kind: 'wins', gain: won })
  }

  // Sem nada tático a dizer: o que o lance faz de bom na posição
  if (!motifs.length && POSITIONAL.includes(classification)) return positionalMotifs(fenBefore, uci)

  return motifs.slice(0, 2)
}

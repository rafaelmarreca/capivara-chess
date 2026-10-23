import { Chess, type Square } from 'chess.js'
import type {
  AnalyzedMove,
  Classification,
  GameAnalysis,
  LineMove,
  ParsedGame,
  ParsedMove,
  PlayerSummary,
  PositionEval,
  Score,
} from '../types'
import { gameAccuracy, moveAccuracy } from './accuracy'
import { isBookPosition, openingName } from './book'
import { classifyMove } from './classify'
import { isSacrifice, VALUES } from './sacrifice'
import { detectMotifs, type ExplainInput } from './explain'
import { bestReason } from './bestReason'
import { CHECKMATE_CP, winPercentFor, winPercentWhite } from './winPercent'

export const CLASSIFICATIONS: Classification[] = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'book',
  'forced',
  'inaccuracy',
  'mistake',
  'miss',
  'blunder',
]

/** Avaliação de posição terminal (mate/empate) sem precisar do motor. */
export function terminalEval(fen: string): PositionEval | null {
  const chess = new Chess(fen)
  if (chess.isCheckmate()) {
    const cp = chess.turn() === 'w' ? -CHECKMATE_CP : CHECKMATE_CP
    return { fen, depth: 0, lines: [{ score: { cp }, pv: [] }] }
  }
  if (chess.isDraw() || chess.isStalemate()) {
    return { fen, depth: 0, lines: [{ score: { cp: 0 }, pv: [] }] }
  }
  return null
}

export function positionsOf(game: ParsedGame): string[] {
  return [game.startFen, ...game.moves.map((m) => m.fenAfter)]
}

function pvToLine(fen: string, pv: string[], max = 8): LineMove[] {
  const chess = new Chess(fen)
  const out: LineMove[] = []
  for (const uci of pv.slice(0, max)) {
    const moveNumber = chess.moveNumber()
    try {
      const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
      out.push({ san: m.san, uci, from: m.from, to: m.to, color: m.color, moveNumber, fenAfter: m.after })
    } catch {
      break
    }
  }
  return out
}

const isMateFor = (score: Score | undefined, color: 'w' | 'b') =>
  score?.mate != null && (color === 'w' ? score.mate > 0 : score.mate < 0)

const emptyCounts = () =>
  Object.fromEntries(CLASSIFICATIONS.map((c) => [c, 0])) as Record<Classification, number>

/** Valor da peça capturada no lance (0 se não capturou). */
function capturedValue(move?: ParsedMove): number {
  const piece = move && new Chess(move.fenBefore).get(move.to as Square)
  return piece && piece.color !== move.color ? VALUES[piece.type] : 0
}

/** Combina a partida com as avaliações de cada posição (n+1) e gera a análise completa. */
export function buildAnalysis(game: ParsedGame, evals: PositionEval[], depth: number): GameAnalysis {
  const scoreAt = (i: number): Score => evals[i].lines[0]?.score ?? { cp: 0 }
  const winsWhite = evals.map((_, i) => winPercentWhite(scoreAt(i)))

  let inBook = true
  let opening: { eco: string; name: string } | undefined
  const moves: AnalyzedMove[] = []

  game.moves.forEach((move, i) => {
    const before = evals[i]
    const best = before.lines[0]
    const winBefore = winPercentFor(scoreAt(i), move.color)
    const winAfter = winPercentFor(scoreAt(i + 1), move.color)
    const loss = Math.max(0, winBefore - winAfter)

    const isBook = inBook && isBookPosition(move.fenAfter)

    const second = before.lines[1]
    const classification = classifyMove({
      isBook,
      legalMoves: new Chess(move.fenBefore).moves().length,
      isBest: best?.pv[0] === move.uci,
      isSacrifice: isSacrifice(move.fenBefore, move.uci),
      winBefore,
      winAfter,
      secondBestWin: second ? winPercentFor(second.score, move.color) : undefined,
      previousOpponent: moves[i - 1]?.classification,
      mateOnlyViaBest: isMateFor(best?.score, move.color) && !isMateFor(second?.score, move.color),
    })

    if (classification === 'book') {
      opening = openingName(move.fenAfter) ?? opening
    } else {
      inBook = false
    }

    const bestLine = best ? pvToLine(move.fenBefore, best.pv) : []
    const explainInput: ExplainInput = {
      fenBefore: move.fenBefore,
      fenAfter: move.fenAfter,
      uci: move.uci,
      color: move.color,
      classification,
      before,
      after: evals[i + 1],
      // Só é retomada se for na mesma casa; tomar outra peça é ganho inteiro
      previousCaptured: game.moves[i - 1]?.to === move.to ? capturedValue(game.moves[i - 1]) : 0,
    }
    const motifs = detectMotifs(explainInput)
    moves.push({
      ...move,
      classification,
      winBefore,
      winAfter,
      loss,
      accuracy: classification === 'book' || classification === 'forced' ? 100 : moveAccuracy(loss),
      evalAfter: scoreAt(i + 1),
      bestMoveUci: best?.pv[0],
      bestMoveSan: bestLine[0]?.san,
      bestLine,
      opening: opening?.name,
      motifs,
      bestReason: bestReason(explainInput, motifs),
    })
  })

  const summary = (color: 'w' | 'b'): PlayerSummary => {
    const own = moves.map((m, i) => ({ m, i })).filter(({ m }) => m.color === color)
    const counts = emptyCounts()
    own.forEach(({ m }) => counts[m.classification]++)
    return {
      accuracy: gameAccuracy(
        winsWhite,
        own.map(({ m }) => m.accuracy),
        own.map(({ i }) => i),
      ),
      counts,
    }
  }

  return {
    depth,
    initialEval: scoreAt(0),
    moves,
    white: summary('w'),
    black: summary('b'),
    opening,
  }
}

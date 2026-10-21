import type { GameAnalysis, ParsedGame, PositionEval } from '../types'
import { StockfishEngine } from '../engine/stockfish'
import { buildAnalysis, positionsOf, terminalEval } from './analyzeGame'

let engine: StockfishEngine | null = null

export async function runAnalysis(
  game: ParsedGame,
  depth: number,
  onProgress: (done: number, total: number) => void,
  signal: AbortSignal,
): Promise<{ analysis: GameAnalysis; evals: PositionEval[] }> {
  const fens = positionsOf(game)

  engine ??= new StockfishEngine()
  const evals: PositionEval[] = []
  onProgress(0, fens.length)
  for (const fen of fens) {
    if (signal.aborted) {
      engine.stop()
      throw new DOMException('Análise cancelada', 'AbortError')
    }
    const ev = terminalEval(fen) ?? (await engine.analyse(fen, depth, 2))
    // Guarda só o começo da linha principal para economizar espaço na biblioteca
    evals.push({ ...ev, lines: ev.lines.map((l) => ({ ...l, pv: l.pv.slice(0, 10) })) })
    onProgress(evals.length, fens.length)
  }
  return { analysis: buildAnalysis(game, evals, depth), evals }
}

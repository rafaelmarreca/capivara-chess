import type { GameAnalysis, ParsedGame, PositionEval } from '../types'
import { StockfishEngine } from '../engine/stockfish'
import { buildAnalysis, positionsOf, terminalEval } from './analyzeGame'

const CACHE_PREFIX = 'lichess-analyzer:v1:'

function hash(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

function cacheKey(fens: string[], depth: number) {
  return `${CACHE_PREFIX}${hash(fens.join('|'))}:${depth}`
}

function readCache(key: string): PositionEval[] | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as PositionEval[]) : null
  } catch {
    return null
  }
}

function writeCache(key: string, evals: PositionEval[]) {
  try {
    localStorage.setItem(key, JSON.stringify(evals))
  } catch {
    // Cache é só conveniência; ignora quota cheia ou storage bloqueado
  }
}

let engine: StockfishEngine | null = null

export async function runAnalysis(
  game: ParsedGame,
  depth: number,
  onProgress: (done: number, total: number) => void,
  signal: AbortSignal,
): Promise<GameAnalysis> {
  const fens = positionsOf(game)
  const key = cacheKey(fens, depth)
  const cached = readCache(key)
  if (cached?.length === fens.length) return buildAnalysis(game, cached, depth)

  engine ??= new StockfishEngine()
  const evals: PositionEval[] = []
  onProgress(0, fens.length)
  for (const fen of fens) {
    if (signal.aborted) {
      engine.stop()
      throw new DOMException('Análise cancelada', 'AbortError')
    }
    const ev = terminalEval(fen) ?? (await engine.analyse(fen, depth, 2))
    // Guarda só o começo da linha principal para economizar espaço no cache
    evals.push({ ...ev, lines: ev.lines.map((l) => ({ ...l, pv: l.pv.slice(0, 10) })) })
    onProgress(evals.length, fens.length)
  }
  writeCache(key, evals)
  return buildAnalysis(game, evals, depth)
}

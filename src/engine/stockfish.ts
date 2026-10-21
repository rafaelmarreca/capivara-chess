import type { EngineLine, PositionEval, Score } from '../types'

const ENGINE_URL = '/stockfish/stockfish-19-lite-single.js'

/** Wrapper UCI mínimo para o Stockfish rodando em Web Worker. */
export class StockfishEngine {
  private worker: Worker
  private listeners = new Set<(line: string) => void>()
  private ready: Promise<void>
  private queue: Promise<unknown> = Promise.resolve()

  constructor() {
    this.worker = new Worker(ENGINE_URL)
    this.worker.onmessage = (e: MessageEvent<string>) => {
      for (const l of this.listeners) l(String(e.data))
    }
    this.ready = (async () => {
      this.send('uci')
      await this.waitFor((l) => l === 'uciok')
      this.send('setoption name Hash value 64')
      this.send('isready')
      await this.waitFor((l) => l === 'readyok')
    })()
  }

  private send(cmd: string) {
    this.worker.postMessage(cmd)
  }

  private waitFor(match: (line: string) => boolean, onLine?: (line: string) => void) {
    return new Promise<string>((resolve) => {
      const listener = (line: string) => {
        onLine?.(line)
        if (match(line)) {
          this.listeners.delete(listener)
          resolve(line)
        }
      }
      this.listeners.add(listener)
    })
  }

  /** Avalia uma posição. As avaliações retornadas são do ponto de vista das brancas. */
  analyse(fen: string, depth: number, multiPv = 2): Promise<PositionEval> {
    const run = async () => {
      await this.ready
      const whiteToMove = fen.split(' ')[1] === 'w'
      const lines = new Map<number, EngineLine & { depth: number }>()
      this.send(`setoption name MultiPV value ${multiPv}`)
      this.send(`position fen ${fen}`)
      this.send(`go depth ${depth}`)
      await this.waitFor(
        (l) => l.startsWith('bestmove'),
        (l) => {
          const parsed = parseInfo(l, whiteToMove)
          if (parsed) lines.set(parsed.multipv, parsed)
        },
      )
      const sorted = [...lines.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v)
      return {
        fen,
        depth: Math.max(0, ...sorted.map((l) => l.depth)),
        lines: sorted.map(({ score, pv }) => ({ score, pv })),
      }
    }
    const result = this.queue.then(run, run)
    this.queue = result.catch(() => undefined)
    return result
  }

  stop() {
    this.send('stop')
  }

  terminate() {
    this.worker.terminate()
    this.listeners.clear()
  }
}

export function parseInfo(line: string, whiteToMove: boolean) {
  if (!line.startsWith('info ') || !line.includes(' pv ') || line.includes('lowerbound') || line.includes('upperbound'))
    return null
  const depth = Number(line.match(/ depth (\d+)/)?.[1] ?? 0)
  const multipv = Number(line.match(/ multipv (\d+)/)?.[1] ?? 1)
  const m = line.match(/ score (cp|mate) (-?\d+)/)
  if (!m) return null
  const sign = whiteToMove ? 1 : -1
  const value = Number(m[2]) * sign
  const score: Score = m[1] === 'cp' ? { cp: value } : { mate: value }
  const pv = line.split(' pv ')[1].trim().split(/\s+/)
  return { depth, multipv, score, pv }
}

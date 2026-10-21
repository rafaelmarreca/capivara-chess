import { Chess, DEFAULT_POSITION } from 'chess.js'
import type { ParsedGame, ParsedMove } from '../types'

/** Divide um arquivo PGN com várias partidas em textos individuais. */
export function splitPgn(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '').trim()
  if (!normalized) return []
  const games: string[] = []
  let current: string[] = []
  let seenMoves = false
  for (const line of normalized.split('\n')) {
    const isHeader = line.startsWith('[')
    if (isHeader && seenMoves) {
      games.push(current.join('\n').trim())
      current = []
      seenMoves = false
    }
    if (!isHeader && line.trim()) seenMoves = true
    current.push(line)
  }
  if (current.join('').trim()) games.push(current.join('\n').trim())
  return games
}

/**
 * Ajusta construções válidas em PGN que o parser do chess.js rejeita:
 * comentários consecutivos (`{a} {b}`) e comentário logo após o número do lance (`1. {a} e4`).
 */
export function normalizePgn(pgn: string): string {
  let out = pgn
  let prev
  do {
    prev = out
    out = out
      .replace(/\}\s*\{/g, ' ') // comentários não se aninham, então `}` sempre fecha um
      .replace(/(\d+\.(?:\.\.)?)\s*(\{[^}]*\})/g, '$2 $1')
  } while (out !== prev)
  return out
}

export function parseGame(pgn: string): ParsedGame {
  const chess = new Chess()
  chess.loadPgn(normalizePgn(pgn))
  const headers = Object.fromEntries(
    Object.entries(chess.getHeaders()).filter(([, v]) => v != null && v !== ''),
  ) as Record<string, string>
  const startFen = headers.FEN ?? DEFAULT_POSITION

  const comments = new Map(chess.getComments().map((c) => [c.fen, c.comment]))
  const history = chess.history({ verbose: true })
  const moves: ParsedMove[] = history.map((m, i) => {
    const clock = comments.get(m.after)?.match(/\[%clk\s+([\d:.]+)\]/)?.[1]
    return {
      ply: i + 1,
      color: m.color,
      san: m.san,
      uci: m.from + m.to + (m.promotion ?? ''),
      from: m.from,
      to: m.to,
      fenBefore: m.before,
      fenAfter: m.after,
      clock,
    }
  })
  return { headers, startFen, moves }
}

export function parsePgnFile(text: string): ParsedGame[] {
  return splitPgn(text).map(parseGame)
}

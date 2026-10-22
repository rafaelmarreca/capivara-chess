import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js'

export interface Arrow {
  from: Square
  to: Square
}

/** Motivos posicionais: o que o lance faz de bom, sem depender de ganho de material. */
export type PositionalMotif =
  | { kind: 'castles'; arrow?: Arrow }
  | { kind: 'develops'; piece: PieceSymbol; square: Square; arrow?: Arrow }
  | { kind: 'opensLine'; piece: 'b' | 'q'; from: Square; to: Square; arrow?: Arrow }
  | { kind: 'centerPawn'; square: Square }
  | { kind: 'openFile'; piece: 'r' | 'q'; file: string; semi: boolean; arrow?: Arrow }
  | { kind: 'passedPawn'; square: Square; arrow?: Arrow }

// "Desenvolvimento" só faz sentido na abertura
const DEVELOPMENT_UNTIL = 15
const CENTER: Square[] = ['d4', 'e4', 'd5', 'e5']
const HOME: Record<Color, Partial<Record<Square, PieceSymbol>>> = {
  w: { b1: 'n', g1: 'n', c1: 'b', f1: 'b', d1: 'q' },
  b: { b8: 'n', g8: 'n', c8: 'b', f8: 'b', d8: 'q' },
}

const FILES = 'abcdefgh'
const sq = (file: number, rank: number) => `${FILES[file]}${rank}` as Square

/** A mesma posição, mas com `color` para jogar (para ver o alcance das peças dele). */
function withTurn(fen: string, color: Color): Chess | null {
  const parts = fen.split(' ')
  parts[1] = color
  parts[3] = '-'
  try {
    return new Chess(parts.join(' '))
  } catch {
    return null // ex.: o rei do outro lado em xeque
  }
}

/** Casa mais distante que a peça em `from` alcança (para a seta). */
function farthest(chess: Chess, from: Square): Square | null {
  const moves = chess.moves({ square: from, verbose: true })
  let best: Square | null = null
  let dist = -1
  for (const m of moves) {
    const d = Math.max(Math.abs(m.to.charCodeAt(0) - from.charCodeAt(0)), Math.abs(+m.to[1] - +from[1]))
    if (d > dist) [best, dist] = [m.to, d]
  }
  return best
}

function pawnsOn(chess: Chess, file: number, color?: Color): boolean {
  for (let r = 1; r <= 8; r++) {
    const p = chess.get(sq(file, r))
    if (p?.type === 'p' && (!color || p.color === color)) return true
  }
  return false
}

/** Peões passados de `color`: nenhum peão adversário à frente na mesma coluna ou nas vizinhas. */
function passedPawns(chess: Chess, color: Color): Square[] {
  const out: Square[] = []
  const dir = color === 'w' ? 1 : -1
  for (let f = 0; f < 8; f++) {
    for (let r = 1; r <= 8; r++) {
      const p = chess.get(sq(f, r))
      if (p?.type !== 'p' || p.color !== color) continue
      let blocked = false
      for (let df = -1; df <= 1 && !blocked; df++) {
        if (f + df < 0 || f + df > 7) continue
        for (let rr = r + dir; rr >= 1 && rr <= 8; rr += dir) {
          const q = chess.get(sq(f + df, rr))
          if (q?.type === 'p' && q.color !== color) blocked = true
        }
      }
      if (!blocked) out.push(sq(f, r))
    }
  }
  return out
}

/** No máximo um motivo posicional, pela ordem: roque, peão passado, coluna aberta, desenvolvimento, abre linha, centro. */
export function positionalMotifs(fenBefore: string, uci: string): PositionalMotif[] {
  const before = new Chess(fenBefore)
  const color = before.turn()
  const fullmove = before.moveNumber()
  let move
  try {
    move = before.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
  } catch {
    return []
  }
  const after = before
  const fenAfter = after.fen()

  if (move.isKingsideCastle() || move.isQueensideCastle()) return [{ kind: 'castles', arrow: { from: move.from, to: move.to } }]

  if (move.piece === 'p') {
    const prev = new Set(passedPawns(new Chess(fenBefore), color))
    // Um peão que já era passado e só andou não foi "criado"
    const now = passedPawns(after, color).filter((s) => !prev.has(s) && !(s === move.to && prev.has(move.from)))
    if (now.length) {
      const s = now.includes(move.to) ? move.to : now[0]
      return [{ kind: 'passedPawn', square: s, arrow: { from: s, to: `${s[0]}${color === 'w' ? 8 : 1}` as Square } }]
    }
  }

  if ((move.piece === 'r' || move.piece === 'q') && move.from[0] !== move.to[0]) {
    const f = FILES.indexOf(move.to[0])
    if (!pawnsOn(after, f, color)) {
      const semi = pawnsOn(after, f)
      const end = sq(f, color === 'w' ? 8 : 1)
      const mine = withTurn(fenAfter, color)
      const reach = mine?.moves({ square: move.to, verbose: true }).filter((m) => m.to[0] === move.to[0])
      const far = reach?.reduce<Square>((a, m) => (Math.abs(+m.to[1] - +move.to[1]) > Math.abs(+a[1] - +move.to[1]) ? m.to : a), move.to)
      return [{ kind: 'openFile', piece: move.piece, file: move.to[0], semi, arrow: { from: move.to, to: far && far !== move.to ? far : end } }]
    }
  }

  if ((move.piece === 'n' || move.piece === 'b') && HOME[color][move.from] === move.piece && fullmove <= DEVELOPMENT_UNTIL) {
    return [{ kind: 'develops', piece: move.piece, square: move.to, arrow: { from: move.from, to: move.to } }]
  }

  if (move.piece === 'p') {
    const pre = withTurn(fenBefore, color)
    const post = withTurn(fenAfter, color)
    if (pre && post) {
      // Bispo antes da dama: é o que o jogador costuma querer liberar
      for (const piece of ['b', 'q'] as const) {
        for (const [home, type] of Object.entries(HOME[color]) as [Square, PieceSymbol][]) {
          if (type !== piece || post.get(home)?.type !== piece || post.get(home)?.color !== color) continue
          const gained = post.moves({ square: home }).length - pre.moves({ square: home }).length
          const to = farthest(post, home)
          if (gained >= 2 && to) return [{ kind: 'opensLine', piece, from: home, to, arrow: { from: home, to } }]
        }
      }
    }
    if (CENTER.includes(move.to)) return [{ kind: 'centerPawn', square: move.to }]
  }

  return []
}

import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js'

const VALUES: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

/** Quanto material cada peça de `color` perderia se capturada agora (troca estática simplificada). */
function hangingPieces(chess: Chess, color: Color): Map<Square, number> {
  const opp: Color = color === 'w' ? 'b' : 'w'
  const result = new Map<Square, number>()
  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece || piece.color !== color || piece.type === 'k') continue
      const attackers = chess.attackers(piece.square, opp)
      if (attackers.length === 0) continue
      const cheapest = Math.min(
        ...attackers.map((sq) => {
          const t = chess.get(sq)!.type
          return t === 'k' ? 100 : VALUES[t]
        }),
      )
      const defended = chess.attackers(piece.square, color).length > 0
      // Rei só captura peça indefesa
      if (cheapest === 100 && defended) continue
      const loss = defended ? VALUES[piece.type] - cheapest : VALUES[piece.type]
      if (loss > 0) result.set(piece.square, loss)
    }
  }
  return result
}

/**
 * Indica se o lance entrega material: deixa uma peça capturável (que não estava antes)
 * cujo valor supera em pelo menos 2 pontos o que foi capturado no lance.
 */
export function isSacrifice(fenBefore: string, uci: string): boolean {
  const chess = new Chess(fenBefore)
  const mover = chess.turn()
  const before = hangingPieces(chess, mover)
  const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
  const captured = move.captured ? VALUES[move.captured] : 0
  const after = hangingPieces(chess, mover)

  let maxLoss = 0
  for (const [sq, loss] of after) {
    const isNew = sq === move.to || (before.get(sq) ?? 0) < loss
    if (isNew) maxLoss = Math.max(maxLoss, loss)
  }
  return maxLoss - captured >= 2
}

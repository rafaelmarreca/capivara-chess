/** Precisão de um lance a partir da perda de win% (fórmula do lichess). */
export function moveAccuracy(loss: number): number {
  const raw = 103.1668 * Math.exp(-0.04354 * Math.max(0, loss)) - 3.1669
  return Math.max(0, Math.min(100, raw + 1)) // +1 de bônus por incerteza, como no lichess
}

function stdDev(xs: number[]): number {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length)
}

/**
 * Precisão agregada de um jogador (método lichess): média entre a média ponderada
 * pela volatilidade da posição e a média harmônica.
 * @param winsWhite win% das brancas em cada posição da partida (n+1 valores)
 * @param accuracies precisão de cada lance do jogador
 * @param plies índices (0-based) dos lances do jogador na partida
 */
export function gameAccuracy(winsWhite: number[], accuracies: number[], plies: number[]): number {
  if (accuracies.length === 0) return 0
  const windowSize = Math.max(2, Math.min(8, Math.floor(winsWhite.length / 10)))
  const weights = plies.map((ply) => {
    const start = Math.max(0, Math.min(ply, winsWhite.length - windowSize))
    const win = winsWhite.slice(start, start + windowSize)
    return Math.max(0.5, Math.min(12, stdDev(win)))
  })
  const weighted =
    accuracies.reduce((s, a, i) => s + a * weights[i], 0) / weights.reduce((a, b) => a + b, 0)
  const harmonic = accuracies.length / accuracies.reduce((s, a) => s + 1 / Math.max(a, 1), 0)
  return (weighted + harmonic) / 2
}

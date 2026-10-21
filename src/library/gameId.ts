import type { ParsedGame } from '../types'

/**
 * Identidade da partida: posição inicial + lances. Os cabeçalhos ficam de fora para que
 * a mesma partida vinda do Lichess e colada à mão seja a mesma entrada.
 */
export async function gameId(game: ParsedGame): Promise<string> {
  const text = game.startFen + '\n' + game.moves.map((m) => m.uci).join(' ')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 20)
}

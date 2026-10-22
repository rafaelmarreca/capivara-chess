// Distância mínima para um arrasto contar como gesto (e não como toque)
const MIN_DRAG = 40

/**
 * O que um arrasto vertical faz com o cabeçalho escondido do celular: puxar para baixo na metade
 * de cima abre; puxar para cima fecha. A metade de baixo (card, faixa, botões) não abre.
 */
export function swipeIntent(startY: number, endY: number, viewportH: number, open: boolean): 'open' | 'close' | null {
  const dy = endY - startY
  if (!open && dy >= MIN_DRAG && startY < viewportH / 2) return 'open'
  if (open && dy <= -MIN_DRAG) return 'close'
  return null
}

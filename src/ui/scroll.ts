/**
 * Posição de rolagem que deixa o item visível dentro do contêiner, mexendo o mínimo (como
 * block: 'nearest'), num eixo qualquer. `itemStart` é relativo ao conteúdo do contêiner.
 */
export function nearestScroll(scroll: number, size: number, itemStart: number, itemSize: number): number {
  if (itemStart < scroll) return itemStart
  const end = itemStart + itemSize
  if (end > scroll + size) return end - size
  return scroll
}

export function nearestScrollTop(
  container: { scrollTop: number; height: number },
  item: { top: number; height: number },
): number {
  return nearestScroll(container.scrollTop, container.height, item.top, item.height)
}

/**
 * Rola só o contêiner rolável mais próximo até o elemento. Diferente de scrollIntoView, não
 * rola a página: no celular a lista de lances fica abaixo do tabuleiro e a tela fugia dele.
 */
export function scrollWithinParent(el: HTMLElement, axis: 'y' | 'x' = 'y'): void {
  const y = axis === 'y'
  let box = el.parentElement
  while (box && !/(auto|scroll)/.test(getComputedStyle(box)[y ? 'overflowY' : 'overflowX'])) box = box.parentElement
  if (!box) return
  const r = el.getBoundingClientRect()
  const b = box.getBoundingClientRect()
  if (y) {
    if (box.scrollHeight <= box.clientHeight) return
    box.scrollTop = nearestScroll(box.scrollTop, box.clientHeight, r.top - b.top + box.scrollTop, r.height)
  } else {
    if (box.scrollWidth <= box.clientWidth) return
    box.scrollLeft = nearestScroll(box.scrollLeft, box.clientWidth, r.left - b.left + box.scrollLeft, r.width)
  }
}

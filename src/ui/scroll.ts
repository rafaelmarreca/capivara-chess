/**
 * scrollTop que deixa o item visível dentro do contêiner, mexendo o mínimo (como block: 'nearest').
 * `item.top` é relativo ao conteúdo do contêiner.
 */
export function nearestScrollTop(
  container: { scrollTop: number; height: number },
  item: { top: number; height: number },
): number {
  if (item.top < container.scrollTop) return item.top
  const bottom = item.top + item.height
  if (bottom > container.scrollTop + container.height) return bottom - container.height
  return container.scrollTop
}

/**
 * Rola só o contêiner rolável mais próximo até o elemento. Diferente de scrollIntoView, não
 * rola a página: no celular a lista de lances fica abaixo do tabuleiro e a tela fugia dele.
 */
export function scrollWithinParent(el: HTMLElement): void {
  let box = el.parentElement
  while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement
  if (!box || box.scrollHeight <= box.clientHeight) return
  const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop
  box.scrollTop = nearestScrollTop({ scrollTop: box.scrollTop, height: box.clientHeight }, { top, height: el.offsetHeight })
}

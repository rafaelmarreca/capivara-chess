export type NavAction = 'first' | 'prev' | 'next' | 'last'

/**
 * Com a linha do motor aberta, os botões de navegação andam por ela. `null` = de volta à partida
 * (anterior no primeiro lance, ou início).
 */
export function lineNav(action: NavAction, index: number, length: number): number | null {
  switch (action) {
    case 'first':
      return null
    case 'prev':
      return index > 0 ? index - 1 : null
    case 'next':
      return Math.min(index + 1, length - 1)
    case 'last':
      return length - 1
  }
}

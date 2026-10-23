import type { Color } from '../types'

/** Nomes de usuário (Lichess, chess.com…) que o jogador marcou como "sou eu", normalizados. */
export const normalizeName = (name: string) => name.trim().toLowerCase()

/** Lado do jogador nesta partida, pelos cabeçalhos do PGN; null se nenhum nome bater. */
export function sideOf(headers: Record<string, string>, names: string[]): Color | null {
  const mine = new Set(names.map(normalizeName))
  if (headers.White && mine.has(normalizeName(headers.White))) return 'w'
  if (headers.Black && mine.has(normalizeName(headers.Black))) return 'b'
  return null
}

export function toggleName(names: string[], name: string): string[] {
  const n = normalizeName(name)
  return names.includes(n) ? names.filter((x) => x !== n) : [...names, n]
}

export function mergeNames(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b].map(normalizeName))]
}

export function resultFor(headers: Record<string, string>, side: Color): 'vitória' | 'derrota' | 'empate' | null {
  const r = headers.Result
  if (r === '1/2-1/2') return 'empate'
  if (r === '1-0') return side === 'w' ? 'vitória' : 'derrota'
  if (r === '0-1') return side === 'b' ? 'vitória' : 'derrota'
  return null
}

const KEY = 'capivara:me'

export function loadLocalNames(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function saveLocalNames(names: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(names))
  } catch {
    // storage bloqueado: vale só nesta visita
  }
}

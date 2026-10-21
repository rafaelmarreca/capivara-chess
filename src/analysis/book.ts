import data from '../data/openings.json'

const named = data.named as unknown as Record<string, [string, string]>
const book = new Set(data.book as string[])

export const epd = (fen: string) => fen.split(' ').slice(0, 4).join(' ')

export function isBookPosition(fen: string): boolean {
  return book.has(epd(fen))
}

export function openingName(fen: string): { eco: string; name: string } | undefined {
  const hit = named[epd(fen)]
  return hit ? { eco: hit[0], name: hit[1] } : undefined
}

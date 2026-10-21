import type { Note, SavedGame } from './types'

/** Nota mais recente vence; no empate, a de `b`. */
function newer(a: Note | undefined, b: Note | undefined): Note | undefined {
  if (!a) return b
  if (!b) return a
  return a.updatedAt > b.updatedAt ? a : b
}

/** Junta duas versões da mesma partida (ex.: a do aparelho e a da conta) sem perder notas. */
export function mergeGames(a: SavedGame, b: SavedGame): SavedGame {
  const notes: Record<number, Note> = {}
  for (const ply of new Set([...Object.keys(a.notes), ...Object.keys(b.notes)].map(Number))) {
    notes[ply] = newer(a.notes[ply], b.notes[ply])!
  }
  const analysis = a.analyzedAt > b.analyzedAt ? a : b
  return {
    ...analysis,
    createdAt: Math.min(a.createdAt, b.createdAt),
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
    notes,
    comment: newer(a.comment, b.comment),
  }
}

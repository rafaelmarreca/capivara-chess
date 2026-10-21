import type { PositionEval } from '../types'

export interface Note {
  text: string
  updatedAt: number // ms desde a época
}

/** Partida analisada guardada na biblioteca do usuário. */
export interface SavedGame {
  id: string
  pgn: string
  headers: Record<string, string>
  depth: number
  evals: PositionEval[]
  analyzedAt: number
  createdAt: number
  updatedAt: number
  notes: Record<number, Note> // chave = ply (>= 1)
  comment?: Note
}

/** O que a lista precisa: sem as avaliações nem o PGN. */
export type SavedGameMeta = Omit<SavedGame, 'evals' | 'pgn'>

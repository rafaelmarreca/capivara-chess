import type { ParsedGame, PositionEval } from '../types'
import { positionsOf } from '../analysis/analyzeGame'
import type { SavedGame, SavedGameMeta } from './types'

export interface AnalysisInput {
  id: string
  pgn: string
  headers: Record<string, string>
  depth: number
  evals: PositionEval[]
}

/** Onde as análises ficam: no aparelho (sem login) ou na conta (Firestore). A UI não sabe qual. */
export interface GameRepo {
  /** Mais recente (updatedAt) primeiro. */
  list(): Promise<SavedGameMeta[]>
  get(id: string): Promise<SavedGame | null>
  /** Cria ou troca a análise; preserva notas, comentário e createdAt. */
  saveAnalysis(input: AnalysisInput): Promise<void>
  /** Texto vazio remove a nota. Não cria partida que não existe. */
  saveNote(id: string, ply: number, text: string): Promise<void>
  saveComment(id: string, text: string): Promise<void>
  /** Grava a partida inteira (migração para a conta). */
  put(game: SavedGame): Promise<void>
  remove(id: string): Promise<void>
  clear(): Promise<void>
}

export function noteCount(meta: SavedGameMeta): number {
  return Object.keys(meta.notes).length
}

/** A análise salva só serve se tiver uma avaliação por posição da partida. */
export function canReuse(saved: SavedGame, game: ParsedGame): boolean {
  return saved.evals.length === positionsOf(game).length
}

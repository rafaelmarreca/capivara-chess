import type { AnalysisInput } from './repo'

/**
 * Campos que saveAnalysis grava na conta (set com merge). Nunca inclui `notes`: num merge,
 * um mapa vazio substituiria todas as notas. `exists` null = não deu para ler (offline).
 */
export function analysisFields({ pgn, headers, depth }: AnalysisInput, now: number, exists: boolean | null) {
  return { pgn, headers, depth, analyzedAt: now, updatedAt: now, ...(exists === false ? { createdAt: now } : {}) }
}

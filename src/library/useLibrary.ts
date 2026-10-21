import { useCallback, useEffect, useState } from 'react'
import type { GameRepo } from './repo'
import type { SavedGameMeta } from './types'
import { clearLegacyCache, createLocalRepo } from './localRepo'

export interface Library {
  repo: GameRepo | null
  games: SavedGameMeta[]
  refresh(): Promise<void>
}

/** Biblioteca de análises do usuário. O repositório nasce num efeito: nada de IndexedDB no pré-render. */
export function useLibrary(): Library {
  const [repo, setRepo] = useState<GameRepo | null>(null)
  const [games, setGames] = useState<SavedGameMeta[]>([])

  useEffect(() => {
    clearLegacyCache()
    setRepo(createLocalRepo())
  }, [])

  const refresh = useCallback(async () => {
    try {
      setGames(repo ? await repo.list() : [])
    } catch {
      // IndexedDB pode falhar ao abrir (aba privada, storage bloqueado): sem lista, o resto segue
      setGames([])
    }
  }, [repo])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { repo, games, refresh }
}

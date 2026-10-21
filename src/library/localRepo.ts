import { clear, createStore, del, get, set, update, values, type UseStore } from 'idb-keyval'
import type { PositionEval } from '../types'
import type { GameRepo } from './repo'
import type { Note, SavedGame, SavedGameMeta } from './types'

type StoredGame = Omit<SavedGame, 'evals'>

function toMeta(g: StoredGame): SavedGameMeta {
  const meta: Partial<StoredGame> = { ...g }
  delete meta.pgn
  return meta as SavedGameMeta
}

function note(text: string): Note | undefined {
  return text.trim() ? { text, updatedAt: Date.now() } : undefined
}

/** Biblioteca no IndexedDB do aparelho; null quando o navegador não oferece IndexedDB. */
export function createLocalRepo(dbPrefix = 'capivara'): GameRepo | null {
  let games: UseStore
  let evals: UseStore
  try {
    if (typeof indexedDB === 'undefined' || !indexedDB) return null
    games = createStore(`${dbPrefix}-games`, 'games')
    evals = createStore(`${dbPrefix}-evals`, 'evals')
  } catch {
    return null
  }

  const edit = async (id: string, fn: (g: StoredGame) => StoredGame) => {
    if (!(await get(id, games))) return
    await update<StoredGame>(id, (g) => fn(g!), games)
  }

  return {
    async list() {
      const all = await values<StoredGame>(games)
      return all.map(toMeta).sort((a, b) => b.updatedAt - a.updatedAt)
    },

    async get(id) {
      const [g, e] = await Promise.all([get<StoredGame>(id, games), get<PositionEval[]>(id, evals)])
      return g ? { ...g, evals: e ?? [] } : null
    },

    async saveAnalysis({ id, pgn, headers, depth, evals: ev }) {
      const now = Date.now()
      await set(id, ev, evals)
      await update<StoredGame>(
        id,
        (old) => ({
          notes: {},
          createdAt: now,
          ...old,
          id,
          pgn,
          headers,
          depth,
          analyzedAt: now,
          updatedAt: now,
        }),
        games,
      )
    },

    saveNote(id, ply, text) {
      return edit(id, (g) => {
        const notes = { ...g.notes }
        const n = note(text)
        if (n) notes[ply] = n
        else delete notes[ply]
        return { ...g, notes, updatedAt: Date.now() }
      })
    },

    saveComment(id, text) {
      return edit(id, (g) => ({ ...g, comment: note(text), updatedAt: Date.now() }))
    },

    async put({ evals: ev, ...g }) {
      await Promise.all([set(g.id, ev, evals), set(g.id, g, games)])
    },

    async remove(id) {
      await Promise.all([del(id, games), del(id, evals)])
    },

    async clear() {
      await Promise.all([clear(games), clear(evals)])
    },
  }
}

/** Remove o cache de avaliações antigo (`capivara:v1:*`), que a biblioteca substitui. */
export function clearLegacyCache(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('capivara:v1:'))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    // storage bloqueado: nada a limpar
  }
}

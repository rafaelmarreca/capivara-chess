import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameRepo } from './repo'
import type { SavedGameMeta } from './types'
import { clearLegacyCache, createLocalRepo } from './localRepo'
import { isFirebaseConfigured } from './firebaseConfig'
import { migrateLocalToRemote } from './migrate'
import type { AccountUser } from './firebase'

type FirebaseModule = typeof import('./firebase')

// Lembra que houve login, para só baixar o SDK do Firebase no boot de quem já entrou
const SIGNED_IN_KEY = 'capivara:signedIn'

function flag(value?: boolean): boolean {
  try {
    if (value === true) localStorage.setItem(SIGNED_IN_KEY, '1')
    else if (value === false) localStorage.removeItem(SIGNED_IN_KEY)
    return localStorage.getItem(SIGNED_IN_KEY) === '1'
  } catch {
    return false
  }
}

export interface Library {
  repo: GameRepo | null
  games: SavedGameMeta[]
  refresh(): Promise<void>
  configured: boolean
  user: AccountUser | null
  signIn(): Promise<void>
  /** 'unsynced' = não saiu: há notas que ainda não chegaram ao servidor; chame de novo com force. */
  signOut(force?: boolean): Promise<'done' | 'unsynced'>
  /** O App registra aqui como gravar as notas ainda no debounce, para o logout não perdê-las. */
  registerFlush(fn: () => Promise<void>): void
}

/** Biblioteca de análises do usuário. O repositório nasce num efeito: nada de IndexedDB no pré-render. */
export function useLibrary(): Library {
  const configured = isFirebaseConfigured()
  const [repo, setRepo] = useState<GameRepo | null>(null)
  const [games, setGames] = useState<SavedGameMeta[]>([])
  const [user, setUser] = useState<AccountUser | null>(null)
  const fbRef = useRef<FirebaseModule | null>(null)
  const unwatchRef = useRef<(() => void) | null>(null)
  const flushRef = useRef<() => Promise<void>>(async () => {})

  const firebase = useCallback(async () => {
    fbRef.current ??= await import('./firebase')
    const fb = fbRef.current
    unwatchRef.current ??= fb.watchUser(async (u) => {
      if (!u) {
        setUser(null)
        setRepo(createLocalRepo())
        return
      }
      flag(true)
      const remote = fb.createFirestoreRepo(u.uid)
      const local = createLocalRepo()
      if (local) await migrateLocalToRemote(local, remote).catch(() => {})
      setUser(u)
      setRepo(remote)
    })
    return fb
  }, [])

  useEffect(() => {
    clearLegacyCache()
    setRepo(createLocalRepo())
    if (configured && flag()) firebase()
    return () => {
      unwatchRef.current?.()
      unwatchRef.current = null
    }
  }, [configured, firebase])

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

  const signIn = useCallback(async () => {
    const fb = await firebase()
    await fb.signInWithGoogle()
  }, [firebase])

  const signOut = useCallback(
    async (force = false) => {
      await flushRef.current()
      const fb = await firebase()
      if (!force && !(await fb.waitForSync(3000))) return 'unsynced' as const
      await fb.signOutAndClear()
      await createLocalRepo()
        ?.clear()
        .catch(() => {})
      flag(false)
      setUser(null)
      setRepo(createLocalRepo())
      return 'done' as const
    },
    [firebase],
  )

  const registerFlush = useCallback((fn: () => Promise<void>) => {
    flushRef.current = fn
  }, [])

  return { repo, games, refresh, configured, user, signIn, signOut, registerFlush }
}

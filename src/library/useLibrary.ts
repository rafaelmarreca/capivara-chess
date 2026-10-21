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
  /**
   * 'unsynced' = não saiu: há notas que ainda não chegaram ao servidor; chame de novo com force.
   * 'tabs-open' = saiu, mas o cache da conta não pôde ser apagado (outra aba aberta).
   */
  signOut(force?: boolean): Promise<'done' | 'unsynced' | 'tabs-open'>
  /** Repositório para gravar agora: espera a troca local ↔ conta (migração) terminar. */
  ready(): Promise<GameRepo | null>
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
  const repoRef = useRef<GameRepo | null>(null)
  const remoteRef = useRef(false)
  const switchingRef = useRef<Promise<void> | null>(null)
  const signingInRef = useRef(false)

  // O ref é a fonte para quem grava; o estado, para quem renderiza
  const switchRepo = useCallback((next: GameRepo | null, remote: boolean) => {
    repoRef.current = next
    remoteRef.current = remote
    setRepo(next)
  }, [])

  const firebase = useCallback(async () => {
    fbRef.current ??= await import('./firebase')
    const fb = fbRef.current
    unwatchRef.current ??= fb.watchUser(async (u) => {
      // Notas ainda no debounce vão para o repositório atual antes da troca (e da migração)
      await flushRef.current()
      const switching = (async () => {
        if (!u) {
          if (!signingInRef.current) flag(false)
          setUser(null)
          if (remoteRef.current) switchRepo(createLocalRepo(), false)
          return
        }
        flag(true)
        const remote = fb.createFirestoreRepo(u.uid)
        const local = createLocalRepo()
        // Falha de leitura na conta mantém o local para a próxima vez
        if (local) await migrateLocalToRemote(local, remote).catch(() => {})
        setUser(u)
        switchRepo(remote, true)
      })()
      switchingRef.current = switching
      await switching
      if (switchingRef.current === switching) switchingRef.current = null
    })
    return fb
  }, [switchRepo])

  useEffect(() => {
    clearLegacyCache()
    switchRepo(createLocalRepo(), false)
    if (configured && flag()) firebase()
    return () => {
      unwatchRef.current?.()
      unwatchRef.current = null
    }
  }, [configured, firebase, switchRepo])

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
    // A marca vem antes: no redirecionamento a página sai daqui antes do watchUser rodar
    flag(true)
    signingInRef.current = true
    try {
      const fb = await firebase()
      await fb.signInWithGoogle()
    } finally {
      signingInRef.current = false
    }
  }, [firebase])

  const signOut = useCallback(
    async (force = false) => {
      await flushRef.current()
      const fb = await firebase()
      if (!force && !(await fb.waitForSync(3000))) return 'unsynced' as const
      const cleared = await fb.signOutAndClear().catch(() => false)
      await createLocalRepo()
        ?.clear()
        .catch(() => {})
      flag(false)
      setUser(null)
      switchRepo(createLocalRepo(), false)
      return cleared ? ('done' as const) : ('tabs-open' as const)
    },
    [firebase, switchRepo],
  )

  const ready = useCallback(async () => {
    await switchingRef.current
    return repoRef.current
  }, [])

  const registerFlush = useCallback((fn: () => Promise<void>) => {
    flushRef.current = fn
  }, [])

  return { repo, games, refresh, configured, user, signIn, signOut, registerFlush, ready }
}

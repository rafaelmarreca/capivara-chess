/**
 * Tudo que toca no SDK do Firebase. Carregue SEMPRE com `await import('./firebase')`:
 * quem nunca entra com Google não baixa o SDK, e o pré-render não o executa.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth'
import {
  FieldPath,
  clearIndexedDbPersistence,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  orderBy,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  setDoc,
  terminate,
  updateDoc,
  waitForPendingWrites,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore'
import type { PositionEval } from '../types'
import type { GameRepo } from './repo'
import type { Note, SavedGame, SavedGameMeta } from './types'
import { firebaseConfig } from './firebaseConfig'

export interface AccountUser {
  uid: string
  name: string
  photoURL?: string
}

let app: FirebaseApp | undefined
let db: Firestore | undefined

function firebaseApp() {
  return (app ??= initializeApp(firebaseConfig))
}

function firestore() {
  return (db ??= initializeFirestore(firebaseApp(), {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true,
  }))
}

export function watchUser(cb: (user: AccountUser | null) => void): () => void {
  return onAuthStateChanged(getAuth(firebaseApp()), (u) =>
    cb(u ? { uid: u.uid, name: u.displayName ?? u.email ?? 'Conta Google', photoURL: u.photoURL ?? undefined } : null),
  )
}

export async function signInWithGoogle(): Promise<void> {
  const auth = getAuth(firebaseApp())
  const provider = new GoogleAuthProvider()
  try {
    await signInWithPopup(auth, provider)
  } catch (e) {
    // PWA instalado no iOS e navegadores que bloqueiam popup: cai para o redirecionamento
    const code = (e as { code?: string }).code
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-environment') {
      await signInWithRedirect(auth, provider)
    } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
      throw e
    }
  }
}

/** true se tudo que estava pendente chegou ao servidor dentro do prazo. */
export async function waitForSync(timeoutMs: number): Promise<boolean> {
  if (!db) return true
  const timeout = new Promise<boolean>((r) => setTimeout(() => r(false), timeoutMs))
  return Promise.race([waitForPendingWrites(db).then(() => true), timeout])
}

/** Sai da conta e apaga o cache offline do Firestore deste aparelho. */
export async function signOutAndClear(): Promise<void> {
  await signOut(getAuth(firebaseApp()))
  if (db) {
    const old = db
    db = undefined
    await terminate(old)
    await clearIndexedDbPersistence(old)
  }
}

function notesFrom(data: DocumentData | undefined): Record<number, Note> {
  return Object.fromEntries(Object.entries(data ?? {}).map(([ply, n]) => [Number(ply), n as Note]))
}

function toGame(id: string, data: DocumentData, evals: PositionEval[]): SavedGame {
  return {
    id,
    pgn: data.pgn,
    headers: data.headers ?? {},
    depth: data.depth,
    evals,
    analyzedAt: data.analyzedAt,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    notes: notesFrom(data.notes),
    comment: data.comment ?? undefined,
  }
}

/**
 * As promessas de gravação do Firestore só resolvem quando o servidor confirma; offline, nunca.
 * A gravação já vale no cache local na hora, então não esperamos: o logout confere as
 * pendências com waitForSync. Partida apagada em outro aparelho (not-found) é ignorada.
 */
function fire(write: Promise<void>): void {
  write.catch((e) => {
    if ((e as { code?: string }).code !== 'not-found') console.warn('Falha ao sincronizar', e)
  })
}

/** Biblioteca na conta: users/{uid}/games/{id} (tudo menos evals) e users/{uid}/evals/{id}. */
export function createFirestoreRepo(uid: string): GameRepo {
  const fs = firestore()
  const gameRef = (id: string) => doc(fs, 'users', uid, 'games', id)
  const evalsRef = (id: string) => doc(fs, 'users', uid, 'evals', id)

  // Campo a campo, com updateDoc: nunca recria uma partida apagada em outro aparelho
  const edit = async (id: string, field: FieldPath, note: Note | undefined) =>
    fire(updateDoc(gameRef(id), field, note ?? deleteField(), 'updatedAt', Date.now()))
  const note = (text: string): Note | undefined => (text.trim() ? { text, updatedAt: Date.now() } : undefined)

  return {
    async list() {
      const snap = await getDocs(query(collection(fs, 'users', uid, 'games'), orderBy('updatedAt', 'desc')))
      return snap.docs.map((d) => {
        const g: Partial<SavedGame> = toGame(d.id, d.data(), [])
        delete g.evals
        delete g.pgn
        return g as SavedGameMeta
      })
    },

    async get(id) {
      const [g, e] = await Promise.all([getDoc(gameRef(id)), getDoc(evalsRef(id))])
      return g.exists() ? toGame(id, g.data(), (e.data()?.evals as PositionEval[]) ?? []) : null
    },

    async saveAnalysis({ id, pgn, headers, depth, evals }) {
      const now = Date.now()
      const exists = await getDoc(gameRef(id))
        .then((d) => d.exists())
        .catch(() => false)
      fire(setDoc(evalsRef(id), { evals }))
      fire(
        setDoc(
          gameRef(id),
          { pgn, headers, depth, analyzedAt: now, updatedAt: now, ...(exists ? {} : { createdAt: now, notes: {} }) },
          { merge: true },
        ),
      )
    },

    saveNote: (id, ply, text) => edit(id, new FieldPath('notes', String(ply)), note(text)),
    saveComment: (id, text) => edit(id, new FieldPath('comment'), note(text)),

    async put({ evals, ...g }) {
      fire(setDoc(evalsRef(g.id), { evals }))
      fire(setDoc(gameRef(g.id), g))
    },

    async remove(id) {
      fire(deleteDoc(gameRef(id)))
      fire(deleteDoc(evalsRef(id)))
    },

    // O cache da conta é apagado inteiro no logout (signOutAndClear)
    async clear() {},
  }
}

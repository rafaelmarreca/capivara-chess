/**
 * Tudo que toca no SDK do Firebase. Carregue SEMPRE com `await import('./firebase')`:
 * quem nunca entra com Google não baixa o SDK, e o pré-render não o executa.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  getRedirectResult,
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
import { authDomainFor, firebaseConfig } from './firebaseConfig'
import { analysisFields } from './analysisFields'

export interface AccountUser {
  uid: string
  name: string
  photoURL?: string
}

let app: FirebaseApp | undefined
let db: Firestore | undefined

function firebaseApp() {
  return (app ??= initializeApp({ ...firebaseConfig, authDomain: authDomainFor(location.hostname) }))
}

function firestore() {
  return (db ??= initializeFirestore(firebaseApp(), {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true,
  }))
}

/** Erro na volta do redirect (ex.: conta recusada); o sucesso chega pelo watchUser. */
export async function redirectError(): Promise<string | null> {
  try {
    await getRedirectResult(getAuth(firebaseApp()))
    return null
  } catch (e) {
    return (e as { code?: string }).code ?? 'auth/unknown'
  }
}

export function watchUser(cb: (user: AccountUser | null) => void): () => void {
  return onAuthStateChanged(getAuth(firebaseApp()), (u) =>
    cb(u ? { uid: u.uid, name: u.displayName ?? u.email ?? 'Conta Google', photoURL: u.photoURL ?? undefined } : null),
  )
}

/** O helper de login está no mesmo domínio do site (ver authDomainFor): aí o redirect funciona. */
function sameSiteAuth() {
  return authDomainFor(location.hostname) === location.hostname
}

/**
 * No site publicado, redirect (a página sai daqui; o resultado chega pelo watchUser na volta).
 * No localhost o helper é do firebaseapp.com, outro site, e o redirect perde o login: popup.
 * 'blocked' = o navegador bloqueou a janela.
 */
export async function signInWithGoogle(): Promise<'ok' | 'blocked' | 'cancelled'> {
  const auth = getAuth(firebaseApp())
  if (sameSiteAuth()) {
    await signInWithRedirect(auth, new GoogleAuthProvider())
    return 'ok'
  }
  try {
    await signInWithPopup(auth, new GoogleAuthProvider())
    return 'ok'
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-environment') return 'blocked'
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'cancelled'
    throw e
  }
}

/** true se tudo que estava pendente chegou ao servidor dentro do prazo. */
export async function waitForSync(timeoutMs: number): Promise<boolean> {
  if (!db) return true
  const timeout = new Promise<boolean>((r) => setTimeout(() => r(false), timeoutMs))
  return Promise.race([waitForPendingWrites(db).then(() => true), timeout])
}

/**
 * Sai da conta e apaga o cache offline do Firestore deste aparelho. false = não deu para
 * apagar o cache (outra aba do app aberta usando o mesmo banco).
 */
export async function signOutAndClear(): Promise<boolean> {
  await signOut(getAuth(firebaseApp()))
  if (!db) return true
  const old = db
  db = undefined
  await terminate(old)
  try {
    await clearIndexedDbPersistence(old)
    return true
  } catch {
    return false
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
    createdAt: data.createdAt ?? data.analyzedAt,
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
/** Nomes de usuário que o jogador marcou como "sou eu", guardados na conta. */
export async function loadProfileNames(uid: string): Promise<string[]> {
  const snap = await getDoc(doc(firestore(), 'users', uid, 'profile', 'me'))
  const names = snap.data()?.names
  return Array.isArray(names) ? names.filter((x): x is string => typeof x === 'string') : []
}

export function saveProfileNames(uid: string, names: string[]): void {
  fire(setDoc(doc(firestore(), 'users', uid, 'profile', 'me'), { names, updatedAt: Date.now() }))
}

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

    async saveAnalysis(input) {
      const exists = await getDoc(gameRef(input.id))
        .then((d) => d.exists())
        .catch(() => null)
      fire(setDoc(evalsRef(input.id), { evals: input.evals }))
      fire(setDoc(gameRef(input.id), analysisFields(input, Date.now(), exists), { merge: true }))
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

# Análises salvas e sincronização — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Salvar automaticamente cada partida analisada (avaliações + notas por lance + comentário geral) no aparelho, listar na tela inicial e, com login Google opcional, sincronizar entre aparelhos via Firestore.

**Architecture:** Uma interface `GameRepo` com duas implementações: `localRepo` (IndexedDB via `idb-keyval`) sem login e `firestoreRepo` (Firestore com cache offline persistente) logado. Um hook `useLibrary` escolhe o repositório ativo, cuida do login/logout e da migração local → conta. O SDK do Firebase só é carregado por import dinâmico no cliente. A `GameAnalysis` é sempre reconstruída com `buildAnalysis(game, evals, depth)` a partir das avaliações salvas.

**Tech Stack:** React 19, TypeScript, Vite + vite-plugin-pwa, HeroUI 2, Vitest (ambiente node), `idb-keyval`, `firebase` (modular v12+), `fake-indexeddb` (só testes).

**Spec:** `docs/superpowers/specs/2026-10-21-analises-salvas-design.md`

## Global Constraints

- Nada de backend próprio; só Firebase plano Spark. Login **só Google**.
- Sem login, tudo que funciona hoje continua funcionando; login é opcional.
- Nenhum import estático de `firebase/*` fora de `src/library/firebase.ts`, e esse módulo só é carregado com `import()` dinâmico a partir de efeitos e handlers (pré-render via `src/prerender.tsx` não pode tocar no Firebase, `indexedDB` nem `localStorage` no render).
- Texto da interface em português, no tom do app; componentes HeroUI, visual sóbrio.
- Identidade da partida: hash de `startFen` + lances UCI; cabeçalhos do PGN fora.
- Uma entrada por partida; a análise nova substitui a antiga; notas preservadas.
- Só análises completas são salvas.
- Notas gravadas campo a campo (`notes.<ply>`) com `updateDoc`, debounce de **1000 ms**.
- Logout apaga do aparelho os dados da conta (Firestore cache + IndexedDB), após esperar gravações pendentes; offline mostra aviso com "Cancelar" / "Sair mesmo assim".
- Exclusão definitiva, com confirmação.
- Regras do Firestore publicadas **à mão** pelo usuário; nada de deploy Firebase no CI.
- O working tree tem alterações não commitadas do usuário em `src/components/MoveList.tsx` e `src/index.css`: **não descartar**. Antes da Task 4, confirmar com o usuário se já foram commitadas; trabalhar por cima delas.

## Review Focus

1. Digitar uma nota e logo trocar de lance, voltar à tela inicial ou fechar a aba → a nota tem que estar salva (flush do debounce na troca de lance, ao sair da partida e em `pagehide`). Teste na Task 4.
2. Navegador sem IndexedDB (aba privada do Firefox antigo, storage bloqueado) → a análise funciona normalmente, a lista simplesmente não aparece, sem erro na tela. Teste na Task 2.
3. Entrada salva com `evals` de tamanho diferente das posições da partida (dado corrompido, versão antiga) → reanalisa em vez de quebrar. Teste na Task 3.
4. Mesma partida importada do Lichess (com `[%clk]`, cabeçalhos) e colada à mão sem cabeçalhos → mesmo `id`; partida com `[FEN]` inicial diferente → `id` diferente. Teste na Task 1.
5. Build sem config do Firebase preenchida (estado do repositório antes do usuário criar o projeto) → botão "Entrar com Google" não aparece e nada do Firebase é carregado. Teste na Task 5.

---

## Estrutura de arquivos

```
src/library/
  types.ts           tipos salvos (SavedGame, SavedGameMeta, Note)
  gameId.ts          identidade da partida
  merge.ts           mescla local × conta (pura)
  repo.ts            interface GameRepo + helpers puros (toMeta, canReuse)
  localRepo.ts       implementação IndexedDB
  noteSaver.ts       debounce com flush
  firebaseConfig.ts  config pública (preenchida pelo usuário)
  firebase.ts        carregamento do SDK, auth, firestoreRepo (só via import())
  useLibrary.ts      hook: repo ativo, lista, login/logout, migração
src/components/
  SavedGamesList.tsx lista "Minhas análises"
  NoteField.tsx      campo de texto com salvamento
  AccountButton.tsx  entrar / avatar + sair + aviso de não sincronizado
src/__tests__/library.test.ts
firebase.json, firestore.rules, .firebaserc (sem id real; ver Task 5)
docs/firebase-setup.md
```

---

### Task 1: Tipos, identidade da partida e mescla

**Files:**
- Create: `src/library/types.ts`, `src/library/gameId.ts`, `src/library/merge.ts`
- Test: `src/__tests__/library.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // types.ts
  export interface Note { text: string; updatedAt: number }        // ms epoch
  export interface SavedGame {
    id: string
    pgn: string
    headers: Record<string, string>
    depth: number
    evals: PositionEval[]
    analyzedAt: number
    createdAt: number
    updatedAt: number
    notes: Record<number, Note>   // chave = ply (>= 1)
    comment?: Note
  }
  export type SavedGameMeta = Omit<SavedGame, 'evals' | 'pgn'>
  // gameId.ts
  export function gameId(game: ParsedGame): Promise<string>
  // merge.ts
  export function mergeGames(a: SavedGame, b: SavedGame): SavedGame
  ```

- [ ] **Step 1: Escrever os testes**

  `describe('gameId')`:
  - `mesma partida com e sem cabeçalhos dá o mesmo id`: `parseGame` do 2º jogo de `lichessPgn` (já no `analysis.test.ts`; copie a constante) vs `parseGame('1. e4 e5 2. Nf3 Nc6 *')` → ids iguais.
  - `posição inicial diferente muda o id`: mesmos lances `1. e4` com e sem `[FEN "..."]`/`[SetUp "1"]` de uma posição válida → ids diferentes.
  - `id tem 20 caracteres hex`: `expect(id).toMatch(/^[0-9a-f]{20}$/)`.

  `describe('mergeGames')` (monte dois `SavedGame` com helper `make(partial)`):
  - `nota mais recente vence por ply`: a.notes = {3:{text:'A',updatedAt:10}, 5:{text:'x',updatedAt:1}}, b.notes = {3:{text:'B',updatedAt:20}, 7:{text:'y',updatedAt:1}} → notes `{3:'B',5:'x',7:'y'}`.
  - `comentário mais recente vence`; `comentário ausente de um lado é mantido do outro`.
  - `análise feita por último vence`: a {depth:20, analyzedAt:1}, b {depth:12, analyzedAt:2} → depth 12, evals de b.
  - `createdAt é o menor, updatedAt o maior`.
  - `é simétrica nas notas`: `mergeGames(a,b).notes` igual a `mergeGames(b,a).notes`.

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/__tests__/library.test.ts` → FAIL (módulos não existem).

- [ ] **Step 3: Implementar**
  - `gameId`: `crypto.subtle.digest('SHA-256', utf8(startFen + '\n' + moves.map(m => m.uci).join(' ')))`, hex, primeiros 20 chars. `crypto` global existe no Node 20 e nos navegadores.
  - `mergeGames`: empate de `updatedAt`/`analyzedAt` favorece `b`.

- [ ] **Step 4: Rodar** — mesmo comando → PASS.

- [ ] **Step 5: Commit** — `git commit -m "Biblioteca: tipos, id da partida e mescla"`

---

### Task 2: Repositório local (IndexedDB)

**Files:**
- Create: `src/library/repo.ts`, `src/library/localRepo.ts`
- Modify: `package.json` (deps `idb-keyval`; devDeps `fake-indexeddb`)
- Test: `src/__tests__/library.test.ts`

**Interfaces:**
- Consumes: tipos da Task 1.
- Produces:
  ```ts
  // repo.ts
  export interface AnalysisInput { id: string; pgn: string; headers: Record<string,string>; depth: number; evals: PositionEval[] }
  export interface GameRepo {
    list(): Promise<SavedGameMeta[]>              // mais recente (updatedAt) primeiro
    get(id: string): Promise<SavedGame | null>
    saveAnalysis(input: AnalysisInput): Promise<void> // cria ou troca evals/depth/analyzedAt; preserva notes/comment/createdAt
    saveNote(id: string, ply: number, text: string): Promise<void>   // text vazio (após trim) remove a nota
    saveComment(id: string, text: string): Promise<void>             // idem
    put(game: SavedGame): Promise<void>           // grava inteiro (migração)
    remove(id: string): Promise<void>
    clear(): Promise<void>
  }
  export function noteCount(meta: SavedGameMeta): number
  export function canReuse(saved: SavedGame, game: ParsedGame): boolean // evals.length === positionsOf(game).length
  // localRepo.ts
  export function createLocalRepo(): GameRepo | null  // null se IndexedDB indisponível
  export function clearLegacyCache(): void            // remove chaves localStorage 'capivara:v1:*'
  ```

- [ ] **Step 1: Instalar** — `npm i idb-keyval && npm i -D fake-indexeddb`.

- [ ] **Step 2: Escrever os testes** (`import 'fake-indexeddb/auto'` no topo do bloco/arquivo; `beforeEach` → `await repo.clear()`):
  - `saveAnalysis cria e get devolve`; `list não traz evals nem pgn`.
  - `reanalisar preserva notas`: saveAnalysis(depth 14) → saveNote(id, 3, 'oi') → saveAnalysis(depth 18) → `get` tem depth 18 e `notes[3].text === 'oi'`.
  - `nota vazia remove`: saveNote(id,3,'oi') → saveNote(id,3,'  ') → `notes[3]` undefined e `noteCount === 0`.
  - `saveNote em partida inexistente não cria nada`: → `get('nope') === null`.
  - `list ordena por updatedAt desc`.
  - `remove apaga metadados e evals`.
  - Review Focus 2 — `sem IndexedDB devolve null`: `vi.stubGlobal('indexedDB', undefined)` → `createLocalRepo() === null`; `vi.unstubAllGlobals()`.
  - `canReuse falso com evals de tamanho errado` (Review Focus 3).

- [ ] **Step 3: Rodar e ver falhar.**

- [ ] **Step 4: Implementar** — dois stores via `createStore('capivara-games','games')` e `createStore('capivara-evals','evals')`; tudo menos `evals` (inclui `pgn`) num, `{evals}` no outro, chave = id; `list` descarta `pgn`. `createLocalRepo` testa `typeof indexedDB !== 'undefined'` dentro de try/catch. `saveNote`/`saveComment` usam `update()` do idb-keyval e não criam entrada ausente.

- [ ] **Step 5: Rodar** → PASS. `npm run lint` limpo.

- [ ] **Step 6: Commit** — `git commit -m "Biblioteca: repositório local em IndexedDB"`

---

### Task 3: Salvar automático, reabrir sem engine e lista na tela inicial (sem login)

**Files:**
- Modify: `src/analysis/runAnalysis.ts` (remove o cache em localStorage; devolve evals)
- Create: `src/library/useLibrary.ts` (versão sem auth), `src/components/SavedGamesList.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `GameRepo`, `createLocalRepo`, `clearLegacyCache`, `canReuse`, `gameId`, `buildAnalysis`.
- Produces:
  ```ts
  // runAnalysis.ts
  export function runAnalysis(game, depth, onProgress, signal): Promise<{ analysis: GameAnalysis; evals: PositionEval[] }>
  // useLibrary.ts
  export interface Library {
    repo: GameRepo | null
    games: SavedGameMeta[]
    refresh(): Promise<void>
    // Task 6 acrescenta: user, signIn, signOut, configured
  }
  export function useLibrary(): Library
  // SavedGamesList.tsx
  props { games: SavedGameMeta[]; onOpen(id: string): void; onDelete(id: string): void }
  ```

- [ ] **Step 1: `runAnalysis`** — tirar `hash`/`cacheKey`/`readCache`/`writeCache` e devolver `{ analysis, evals }`. Ajustar o único chamador (App). `npm test` continua passando.

- [ ] **Step 2: `useLibrary`** — cria o repo local num `useEffect` (nunca no render), chama `clearLegacyCache()` uma vez, carrega `games`. `repo` null → `games` vazio.

- [ ] **Step 3: Fluxo da análise em `App.tsx`** — trocar o efeito `[game, depth]` por um pedido explícito:
  ```ts
  type Request = { game: ParsedGame; depth: number; reuseSaved: boolean; id: string }
  ```
  - `openGame(g)` → calcula `id = await gameId(g)` e pede com `reuseSaved: true`.
  - `changeDepth(d)` com partida aberta → mesmo `game`/`id`, `reuseSaved: false`.
  - Efeito do pedido: se `reuseSaved` e `repo.get(id)` existe e `canReuse` → `buildAnalysis(game, saved.evals, saved.depth)`, sem engine, e o slider mostra `saved.depth` (sem gravar no localStorage). Senão roda `runAnalysis`; ao terminar **sem abortar**, `repo.saveAnalysis({ id, pgn, headers, depth, evals })` e `library.refresh()`.
  - `pgn` salvo: o texto da partida individual. `ParsedGame` não guarda o texto hoje: acrescentar `pgn: string` em `ParsedGame` (`src/types.ts`) e preencher em `parseGame`.
  - Abrir da lista: `repo.get(id)` → `parseGame(saved.pgn)` → `openGame`.

- [ ] **Step 4: `SavedGamesList`** — abaixo do `<ImportPanel>` na tela inicial, título "Minhas análises", só se `games.length > 0`. Cada item: `Brancas × Pretas`, resultado, data relativa curta (`hoje`, `ontem`, `12 out`) de `updatedAt`, `N notas` quando > 0. Menu (HeroUI `Dropdown`) com "Excluir" → `Modal` de confirmação "Excluir esta análise? As notas também serão apagadas." com "Cancelar"/"Excluir" (danger). Clique no item abre.

- [ ] **Step 5: Verificar no navegador** (preview do dev server): analisar o PGN de exemplo → voltar ao início → item aparece → abrir de novo não mostra barra de progresso → mudar profundidade reanalisa → excluir remove. Sem erros no console.

- [ ] **Step 6: `npm test && npm run build`** → passam (o build roda o pré-render).

- [ ] **Step 7: Commit** — `git commit -m "Análises salvas automaticamente e lista na tela inicial"`

---

### Task 4: Notas por lance e comentário geral

**Files:**
- Create: `src/library/noteSaver.ts`, `src/components/NoteField.tsx`
- Modify: `src/components/MoveDetail.tsx`, `src/components/MoveList.tsx`, `src/components/Summary.tsx`, `src/App.tsx`
- Test: `src/__tests__/library.test.ts`

**Interfaces:**
- Consumes: `GameRepo.saveNote/saveComment/get`.
- Produces:
  ```ts
  // noteSaver.ts
  export interface NoteSaver {
    set(key: number | 'comment', text: string): void   // agenda gravação em 1000 ms
    flush(): Promise<void>                              // grava tudo o que está pendente agora
    pending(): boolean
  }
  export function createNoteSaver(write: (key: number | 'comment', text: string) => Promise<void>, delayMs = 1000): NoteSaver
  // NoteField.tsx
  props { label: string; value: string; onChange(text: string): void; placeholder?: string }
  // MoveDetail: + note?: string; onNoteChange?(text: string): void
  // MoveList:   + notes?: Record<number, string>     (clique na nota → onSelect(ply))
  // Summary:    + comment?: string; onCommentChange?(text: string): void
  ```

- [ ] **Step 1: Testes do `noteSaver`** (`vi.useFakeTimers()`):
  - `grava uma vez após 1000 ms com o último texto`: set(3,'a'), set(3,'ab') → avança 999 ms → 0 chamadas → avança 1 ms → 1 chamada `(3,'ab')`.
  - `chaves diferentes gravam separadas`.
  - Review Focus 1 — `flush grava na hora o pendente`: set(3,'a') → `await flush()` → 1 chamada, `pending() === false`, e avançar 1000 ms não grava de novo.

- [ ] **Step 2: Rodar e ver falhar; implementar; rodar → PASS.**

- [ ] **Step 3: Ligar no `App`** — ao abrir a partida, carregar `notes`/`comment` do `repo.get(id)` para estado local (`Record<number,string>`); `onNoteChange` atualiza o estado na hora e chama `saver.set(ply, text)`. `saver.flush()` ao trocar de lance, ao sair da partida ("Nova partida" / logo) e em `window` `pagehide`. Depois de gravar, `library.refresh()` (para o contador de notas). Antes de existir análise salva (primeira análise rodando), o campo não aparece.

- [ ] **Step 4: UI**
  - `MoveDetail`: `NoteField` com label "Sua nota", placeholder "O que você pensou neste lance?", abaixo da linha do motor. Não aparece para a posição inicial.
  - `MoveList`: depois do `<li>` do par, para cada lance do par com nota, uma linha ocupando as colunas 2–3, texto pequeno, uma linha com reticências (`line-clamp-1`), borda esquerda discreta; botão que chama `onSelect(ply)`. Preservar as mudanças não commitadas do usuário neste arquivo.
  - `Summary`: `NoteField` "Comentário da partida" no fim.
  - Usar HeroUI `Textarea` (`minRows={2}`), como no `ImportPanel`. Setas do teclado já são ignoradas dentro de textarea.

- [ ] **Step 5: Verificar no navegador** — escrever nota no lance 5, pular para o 6 imediatamente, recarregar a página, reabrir pela lista → nota está lá no card e resumida na lista; apagar o texto → some da lista e o contador cai.

- [ ] **Step 6: `npm test && npm run lint && npm run build`** → passam.

- [ ] **Step 7: Commit** — `git commit -m "Notas por lance e comentário da partida"`

---

### Task 5: Firebase — config, carregamento sob demanda, repositório e regras

**Files:**
- Create: `src/library/firebaseConfig.ts`, `src/library/firebase.ts`, `firebase.json`, `firestore.rules`, `docs/firebase-setup.md`
- Modify: `package.json` (dep `firebase`)
- Test: `src/__tests__/library.test.ts`

**Interfaces:**
- Consumes: `GameRepo`, `SavedGame`, tipos.
- Produces:
  ```ts
  // firebaseConfig.ts
  export const firebaseConfig: { apiKey: string; authDomain: string; projectId: string; appId: string }  // strings vazias até o usuário preencher
  export function isFirebaseConfigured(): boolean   // apiKey && projectId não vazios
  // firebase.ts  (carregar SOMENTE via `await import('./firebase')`)
  export function watchUser(cb: (user: { uid: string; name: string; photoURL?: string } | null) => void): () => void
  export function signInWithGoogle(): Promise<void>     // popup; em auth/popup-blocked ou auth/operation-not-supported-in-environment cai para redirect
  export function signOutAndClear(): Promise<void>      // signOut → terminate(db) → clearIndexedDbPersistence(db)
  export function waitForSync(timeoutMs: number): Promise<boolean> // true se waitForPendingWrites resolveu a tempo
  export function createFirestoreRepo(uid: string): GameRepo
  ```

- [ ] **Step 1: Teste (Review Focus 5)** — `isFirebaseConfigured() === false` com a config vazia commitada. E um teste estático: ler os fontes de `src/` (exceto `src/library/firebase.ts`) com `readFileSync`/`readdirSync` e afirmar que nenhum contém `from 'firebase` — garante que o SDK só entra por import dinâmico.

- [ ] **Step 2: `npm i firebase`; implementar.**
  - `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`.
  - Caminhos: `users/{uid}/games/{id}` (tudo menos `evals`, incluindo `pgn`) e `users/{uid}/evals/{id}` = `{ evals }`. `list` descarta `pgn` ao montar `SavedGameMeta`.
  - `list`: `getDocs(query(collection(..., 'games'), orderBy('updatedAt','desc')))`.
  - `saveAnalysis`: `setDoc(evalsRef, {evals})` + `setDoc(gameRef, {pgn, headers, depth, analyzedAt, updatedAt, createdAt?}, { merge: true })` — `createdAt` só se o doc não existir (ler antes).
  - `saveNote`: `updateDoc(gameRef, { ['notes.' + ply]: text ? {text, updatedAt} : deleteField(), updatedAt })`. Sem `set`/merge. Erro `not-found` é engolido.
  - `put`: `setDoc` dos dois docs. `remove`: `deleteDoc` dos dois. `clear`: no-op (o logout limpa o cache).
  - `ply` como chave numérica vira string no Firestore: converter ao ler.

- [ ] **Step 3: Regras** — `firestore.rules`:
  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /users/{uid}/{collection}/{id} {
        allow read, write: if request.auth != null && request.auth.uid == uid
                           && collection in ['games', 'evals'];
      }
    }
  }
  ```
  `firebase.json`: `{ "firestore": { "rules": "firestore.rules" } }`. Sem `.firebaserc` com id real; o guia manda rodar `firebase use --add`.

- [ ] **Step 4: `docs/firebase-setup.md`** — passo a passo para o usuário: criar projeto no console (plano Spark); Authentication → provedor Google; Settings → domínios autorizados: `rafaelmarreca.github.io` e `localhost`; Firestore → criar banco (modo produção, região `southamerica-east1`); registrar app Web e colar a config em `src/library/firebaseConfig.ts`; `npm i -g firebase-tools && firebase login && firebase use --add && firebase deploy --only firestore:rules`. Avisar que a config é pública por natureza.

- [ ] **Step 5: `npm test && npm run build`** → passam; conferir em `dist/` que o chunk do Firebase é separado (`ls dist/assets | grep -i firebase` ou o maior chunk novo não está no `index-*.js`).

- [ ] **Step 6: Commit** — `git commit -m "Firebase: repositório Firestore, regras e guia de configuração"`

---

### Task 6: Login, migração e logout no app

**Files:**
- Modify: `src/library/useLibrary.ts`, `src/App.tsx`
- Create: `src/components/AccountButton.tsx`
- Test: `src/__tests__/library.test.ts`

**Interfaces:**
- Consumes: tudo de `firebase.ts` (por `import()`), `createLocalRepo`, `mergeGames`.
- Produces:
  ```ts
  // useLibrary.ts (acrescenta)
  user: { uid: string; name: string; photoURL?: string } | null
  configured: boolean
  signIn(): Promise<void>
  signOut(force?: boolean): Promise<'done' | 'unsynced'>   // 'unsynced' = não saiu; UI pergunta e chama signOut(true)
  export function migrateLocalToRemote(local: GameRepo, remote: GameRepo): Promise<void>
  ```

- [ ] **Step 1: Teste de `migrateLocalToRemote`** com dois `localRepo`-like em memória (ou dois `createLocalRepo` com stores distintos sob fake-indexeddb — exponha `createLocalRepo(dbPrefix?)` se precisar):
  - `sobe partidas só locais`; `mescla com a que já existe na conta` (nota local mais nova vence, nota remota diferente é mantida); `limpa o local ao final`.

- [ ] **Step 2: Implementar `migrateLocalToRemote`** — para cada `local.list()`: `local.get` + `remote.get` → `remote.put(remote ? mergeGames(remoto, local) : local)`; depois `local.clear()`.

- [ ] **Step 3: Sessão em `useLibrary`**
  - Flag `localStorage['capivara:signedIn'] = '1'` após login; no boot, só faz `import('./firebase')` se `configured` **e** a flag existe (quem nunca logou não baixa o SDK).
  - `watchUser`: com usuário → `repo = createFirestoreRepo(uid)`, roda `migrateLocalToRemote(createLocalRepo(), repo)` se o local tiver itens, `refresh()`. Sem usuário → repo local.
  - `signOut(force)`: `await saver.flush()` (o `App` passa o flush — exponha `registerFlush(fn)` no hook), depois `waitForSync(3000)`; se `false` e `!force` → `'unsynced'`. Senão `signOutAndClear()`, `createLocalRepo()?.clear()`, remove a flag, volta à tela inicial, repo local vazio.

- [ ] **Step 4: `AccountButton`** no cabeçalho (antes do botão de tema), só se `configured`:
  - Deslogado: `Button` `size="sm"` `variant="flat"` "Entrar com Google".
  - Logado: `Avatar` pequeno com `Dropdown`: nome, "Sair".
  - `'unsynced'` → `Modal`: "Há notas ainda não sincronizadas. Sair agora vai perdê-las." com "Cancelar" e "Sair mesmo assim" (danger → `signOut(true)`).

- [ ] **Step 5: Verificar** — sem config: botão não aparece e a aba Network não baixa nada do Firebase. Com config do usuário (só depois da Task 5 feita por ele; se ainda não houver, marcar como pendente e avisar): logar no desktop, criar nota, abrir no celular (ou outro perfil do navegador) e ver a nota; logout limpa a lista; offline + nota + sair → aviso aparece.

- [ ] **Step 6: `npm test && npm run lint && npm run build`** → passam.

- [ ] **Step 7: Commit** — `git commit -m "Login com Google, migração para a conta e logout seguro"`

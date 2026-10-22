# Revisão no celular + comentários concretos — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada lance ganha uma explicação concreta tirada da linha da engine (peça entregue, captura perdida, mate, garfo, ganho de material), e no celular em retrato a revisão cabe na tela, com a lista de lances numa faixa horizontal.

**Architecture:** Um detector puro (`src/analysis/explain.ts`) transforma o lance + `PositionEval` antes/depois em `Motif[]` estruturados, guardados em `AnalyzedMove.motifs` por `buildAnalysis` (funciona para análises já salvas, que são reconstruídas a partir dos `evals`). Um formatador (`src/ui/explainText.ts`) monta as frases em português conforme a perspectiva ("você" = lado de baixo do tabuleiro). No celular em retrato, `App` usa um layout compacto de altura `100dvh`, com `MoveStrip` horizontal, card do lance, nota recolhível e Resumo num `Drawer`.

**Tech Stack:** React 19, TypeScript, chess.js 1.4, HeroUI 2.8 (`Drawer`), Tailwind 4 (container queries), Vitest (node).

**Spec:** `docs/superpowers/specs/2026-10-21-revisao-celular-e-comentarios-design.md`

## Global Constraints

- Frase concreta só quando a PV da engine confirma o ganho/perda (≥ 2 pontos) ou o mate. Sem confirmação, nenhum motivo.
- Valores de material: p1, n3, b3, r5, q9 (os de `src/analysis/sacrifice.ts`).
- "Você" = cor de baixo do tabuleiro (`orientation`); o outro lado em 3ª pessoa ("as brancas"/"as pretas").
- Nomes das peças: peão, cavalo, bispo, torre, dama, rei. Lances em SAN renderizados com `<San>` (notação figurada).
- Layout compacto só quando `max-width: 1023px` **e** `orientation: portrait`. Paisagem e desktop: layout atual.
- No layout compacto: nada rola a página; barra de avaliação vertical ao lado do tabuleiro; tabuleiro não muda de posição durante a análise.
- "Única defesa contra o mate" fora de escopo.
- Texto da UI em português; HeroUI; visual sóbrio.

## Review Focus

1. Peça atacada mas defendida, com troca equilibrada (B×C, P×B) → nenhum motivo "entregou". Teste na Task 1.
2. Jogador já perdido antes do lance (a melhor linha também perde a peça ou já leva a mate) → não culpar o lance ("entregou", "permitiu mate"). Teste na Task 1.
3. PV vazia ou com lance ilegal (avaliação terminal, dado salvo corrompido) → sem motivos, sem exceção. Teste na Task 1.
4. Virar o tabuleiro troca "você" ↔ "as brancas/pretas" no mesmo lance. Teste na Task 2.
5. Celular com análise rodando ou com erro → card mostra progresso/erro no mesmo lugar; o tabuleiro não se move. Verificação no navegador na Task 4.

---

### Task 1: Detector de motivos

**Files:**
- Create: `src/analysis/explain.ts`
- Test: `src/__tests__/explain.test.ts`

**Interfaces:**
- Produces:
  ```ts
  import type { PieceSymbol, Square, Color } from 'chess.js'
  export type Motif =
    | { kind: 'allowedMate'; mateIn: number; firstSan: string }
    | { kind: 'missedMate'; mateIn: number; bestSan: string }
    | { kind: 'hangs'; piece: PieceSymbol; square: Square; captureSan: string; loss: number; defended: boolean }
    | { kind: 'missedCapture'; piece: PieceSymbol; square: Square; bestSan: string; gain: number }
    | { kind: 'allowedFork'; forkSan: string; targets: PieceSymbol[]; loss: number }
    | { kind: 'missedFork'; forkSan: string; targets: PieceSymbol[]; gain: number }
    | { kind: 'wins'; gain: number; mateIn?: number }
  export interface ExplainInput {
    fenBefore: string; fenAfter: string; uci: string; color: Color
    classification: Classification; before: PositionEval; after: PositionEval
  }
  /** Saldo de material para `color` ao jogar `pv` a partir de `fen` (para quando 2 lances seguidos sem captura ou 6 plies). */
  export function materialSwing(fen: string, pv: string[], color: Color): number
  /** Peças (valor > o da peça que moveu, ou rei) atacadas pela peça que acabou de jogar `uci`; [] se < 2. */
  export function forkTargets(fen: string, uci: string): PieceSymbol[]
  export function detectMotifs(input: ExplainInput): Motif[]   // ordenado por prioridade, no máximo 2
  ```

Regras (`played = [uci, ...after.lines[0].pv]`, `best = before.lines[0].pv`, swings do ponto de vista de `color`):
- `allowedMate`: `after` é mate do adversário e `before` não era. `firstSan` = SAN de `after.pv[0]` em `fenAfter`.
- `missedMate`: `before` era mate a favor, `uci !== best[0]`, `after` não é mate a favor.
- `allowedFork`: `swing(played) - swing(best) <= -2` e `forkTargets(fenAfter, after.pv[0]).length >= 2`.
- `hangs`: `swing(played) - swing(best) <= -2`, a 1ª captura do adversário em `after.pv` toma uma peça de `color` (piece/square dela, `captureSan` = SAN dessa captura); `defended` = a casa tinha defensor de `color` em `fenAfter`. Não emitir se já houver `allowedFork`.
- `missedFork`: `uci !== best[0]`, `forkTargets(fenBefore, best[0]).length >= 2`, `swing(best) - swing(played) >= 2`.
- `missedCapture`: `uci !== best[0]`, `best[0]` captura, `swing(best) - swing(played) >= 2`. Não emitir se já houver `missedFork`.
- `wins`: classificação em brilliant/great/best/excellent e (`swing(played) >= 2` ou `after` é mate a favor → `mateIn`).
- Prioridade: allowedMate, missedMate, allowedFork, hangs, missedFork, missedCapture, wins. Qualquer PV vazia/ilegal → ignora o motivo (try/catch), nunca lança.

- [ ] **Step 1: Testes** (`ev(score, pv)` helper monta `PositionEval`):
  - `hangs`: fenBefore `4k3/8/8/8/1b6/8/8/3NK3 w - - 0 1`, uci `d1c3`, after `{cp:-300}` pv `['b4c3']`, before `{cp:0}` pv `['e1e2']`, classif `blunder` → `[{kind:'hangs', piece:'n', square:'c3', captureSan:'Bxc3', loss:3, defended:false}]`.
  - Review Focus 1 — `troca equilibrada não é entregar`: `4k3/8/8/8/1b6/8/1P6/3NK3 w - - 0 1`, uci `d1c3`, after pv `['b4c3','b2c3']` → `[]`.
  - Review Focus 2 — `já perdia a peça de qualquer jeito`: `4k3/8/8/8/1b6/2N5/8/4K3 w - - 0 1` (cavalo já atacado), uci `e1f1`, before pv `['e1d1','b4c3']`, after pv `['b4c3']` → `[]` (a melhor linha perde o mesmo). E `allowedMate` não dispara quando `before` já era mate do adversário.
  - `missedCapture`: `4k3/8/8/3q4/8/2N5/8/4K3 w - - 0 1`, uci `e1e2`, before pv `['c3d5']` `{cp:900}`, after pv `['d5d4']` `{cp:0}` → `missedCapture` dama d5 `Nxd5` gain 9.
  - `wins`: mesma posição, uci `c3d5`, classif `best`, after pv `['e8d7']` → `[{kind:'wins', gain:9}]`.
  - `allowedMate`: `3r2k1/5ppp/8/8/8/8/3R1PPP/6K1 w - - 0 1`, uci `d2a2`, after `{mate:-1}` pv `['d8d1']`, before `{cp:0}` → `allowedMate` mateIn 1 firstSan `Rd1#`.
  - `missedMate`: `6k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1`, uci `g1f1`, before `{mate:1}` pv `['d1d8']`, after `{cp:500}` pv `['g8f8']` → `missedMate` 1 `Rd8#`.
  - `allowedFork`: `4k3/8/8/8/1n6/8/7P/R3K3 w - - 0 1`, uci `h2h3`, after pv `['b4c2','e1d2','c2a1']`, before pv `['a1a4']` → `allowedFork` `Nc2+`, targets contém `k` e `r`, e **sem** `hangs`.
  - `missedFork`: `r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1`, uci `e1e2`, before pv `['b5c7','e8d7','c7a8']`, after pv `['a8a5']` → `missedFork` `Nc7+`.
  - Review Focus 3 — `pv vazia ou ilegal não quebra`: after pv `[]` e outra com `['a1a1']` → `[]`, sem exceção.
  - `materialSwing` unitário: `['b4c3','b2c3']` na posição defendida → 0; `['b4c3']` → -3 para branco.

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/__tests__/explain.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3: Implementar** com `chess.js` (`move({from,to,promotion})` em try/catch; `attackers` para defesa; valores de `sacrifice.ts` — exportar `VALUES` de lá).
- [ ] **Step 4: Rodar** → PASS; `npm test` inteiro verde.
- [ ] **Step 5: Commit** — `git commit -m "Detector de motivos de cada lance a partir da linha da engine"`

---

### Task 2: Frases dos motivos

**Files:**
- Create: `src/ui/explainText.ts`
- Test: `src/__tests__/explain.test.ts`

**Interfaces:**
- Consumes: `Motif` (Task 1).
- Produces:
  ```ts
  export type Segment = string | { san: string }
  export type Subject = 'you' | Color          // 'you' = o lado de baixo do tabuleiro
  export function subjectFor(moveColor: Color, orientation: 'white' | 'black'): Subject
  export function explainMotif(m: Motif, subject: Subject, moveColor: Color): Segment[]
  export const plainText = (s: Segment[]) => string   // junta para testes/aria
  ```

Frases (sujeito "Você"/"As brancas"/"As pretas"; adversário sempre pela cor: "as pretas", "as brancas"):
- hangs: `Você deixou o cavalo em c3 sem defesa: depois de {Bxc3}, você fica uma peça atrás.` (`defended` → "mal defendido"; perda 1 "um peão", 3 "uma peça", 5 "uma torre", ≥9 "a dama", outras "N pontos").
- missedCapture: `Você perdeu a chance de capturar a dama em d5 com {Nxd5}.`
- allowedMate: `Depois disso, as pretas dão mate em 1 com {Rd1#}.` (mate em 1 → "dão mate com").
- missedMate: `Você tinha mate em 1 com {Rd8#}.` / "mate em 3 começando com".
- allowedFork: `Isso permite {Nc2+}, um garfo no rei e na torre.`
- missedFork: `Você tinha {Nc7+}, um garfo no rei e na torre.`
- wins: `Ganha a dama.` / `Leva a mate em 2.`
- 3ª pessoa: "As brancas deixaram…", "As brancas perderam a chance…", "As brancas tinham mate…", "…as brancas ficam uma peça atrás".

- [ ] **Step 1: Testes** — `plainText(explainMotif(hangs, 'you', 'w'))` igual à frase acima; mesma com `subject 'w'` → "As brancas deixaram o cavalo em c3 sem defesa: depois de Bxc3, as brancas ficam uma peça atrás."; Review Focus 4 — `subjectFor('w','white') === 'you'`, `subjectFor('w','black') === 'w'`; uma frase por `kind`.
- [ ] **Step 2: Rodar e ver falhar; implementar; rodar → PASS.**
- [ ] **Step 3: Commit** — `git commit -m "Frases em português dos motivos, com você = lado de baixo"`

---

### Task 3: Comentário no card do lance (desktop e celular)

**Files:**
- Modify: `src/types.ts` (`AnalyzedMove.motifs: Motif[]`), `src/analysis/analyzeGame.ts` (preencher em `buildAnalysis` com `evals[i]`/`evals[i+1]`), `src/components/MoveDetail.tsx` (prop `orientation`, renderiza as frases abaixo da linha da classificação, `<San>` para os segmentos SAN), `src/App.tsx` (passa `orientation`)
- Test: `src/__tests__/analysis.test.ts`

- [ ] **Step 1: Teste** — `parseGame('[SetUp "1"]\n[FEN "4k3/8/8/8/1b6/8/8/3NK3 w - - 0 1"]\n\n1. Nc3 Bxc3 *')` + evals `[ev({cp:0},['e1e2']), ev({cp:-300},['b4c3']), ev({cp:-300},['e1d2'])]` → `buildAnalysis(...).moves[0].motifs[0].kind === 'hangs'` e `moves[1].motifs` é array.
- [ ] **Step 2: Rodar e ver falhar; implementar; rodar → PASS** (`npm test`, `npx tsc -b`, `npm run lint`).
- [ ] **Step 3: Verificar no navegador** (desktop): analisar a partida de exemplo, achar um lance erro/capivarada, ver a frase concreta; virar o tabuleiro troca "Você" por "As brancas/pretas".
- [ ] **Step 4: Commit** — `git commit -m "Comentário concreto de cada lance no card"`

---

### Task 4: Layout compacto no celular em retrato

**Files:**
- Create: `src/ui/useCompactLayout.ts`, `src/components/MoveStrip.tsx`
- Modify: `src/ui/scroll.ts` (eixo horizontal), `src/components/NoteField.tsx` (modo recolhível), `src/App.tsx`, `src/components/icons.tsx` (`IconChart`)
- Test: `src/__tests__/library.test.ts` (scroll)

**Interfaces:**
- Produces:
  ```ts
  export function useCompactLayout(): boolean   // matchMedia('(max-width: 1023px) and (orientation: portrait)'); false no pré-render
  export function scrollWithinParent(el: HTMLElement, axis?: 'y' | 'x'): void  // padrão 'y' (MoveList continua igual)
  // MoveStrip props { moves: (ParsedMove|AnalyzedMove)[]; ply: number; onSelect(ply: number): void }
  // NoteField: + collapsible?: boolean  → botão "✎ Sua nota" (ou prévia da nota) que expande o Textarea
  ```

Layout compacto em `App` (quando `useCompactLayout()` e há partida aberta), de cima para baixo dentro de `div.flex.h-dvh.flex-col`: header; faixa do jogador de cima; área do tabuleiro `flex-1 min-h-0 [container-type:size]` com `EvalBar` + tabuleiro de lado `w-[min(100cqw-1.25rem,100cqh)]`; faixa do jogador de baixo; `MoveStrip`; card (`max-h-40 overflow-y-auto`) com progresso **ou** erro **ou** `MoveDetail` (com `NoteField collapsible`); linha de navegação com os 5 botões atuais + botão `Resumo` (`IconChart`) que abre `Drawer` (placement `bottom`) com `EvalGraph` + `Summary` (com o comentário da partida). `Tabs` laterais não aparecem no compacto.

`MoveStrip`: `flex overflow-x-auto` com número ("16.") e botões de lance (badge 14px + `<San>`, cor da classificação como na `MoveList`), lance atual com `aria-current="step"`; efeito de ply chama `scrollWithinParent(activeEl, 'x')`.

- [ ] **Step 1: Teste do scroll horizontal** — refatorar para `nearestScroll(start, size, itemStart, itemSize)`; manter os 3 testes de `nearestScrollTop` passando e adicionar `scrollWithinParent` não é testável em node: apenas a função pura. Rodar → os testes antigos continuam verdes.
- [ ] **Step 2: Implementar** hook, `MoveStrip`, `NoteField` recolhível, layout compacto e `Drawer`.
- [ ] **Step 3: Verificar no navegador** em 375×740 e 390×664 (Safari com barras):
  - `document.documentElement.scrollHeight <= innerHeight` (nada rola a página).
  - 30× "Próximo": `scrollY` sempre 0; posição do tabuleiro (`getBoundingClientRect().top`) constante; lance atual visível na faixa.
  - Review Focus 5 — durante a análise o card mostra o progresso e o tabuleiro está na mesma posição de depois da análise.
  - Abrir "Resumo" mostra gráfico e precisão; nota expande e salva.
  - Paisagem (740×375) e desktop (1280×800): layout atual intacto.
- [ ] **Step 4: `npm test && npm run lint && npm run build`** → passam.
- [ ] **Step 5: Commit** — `git commit -m "Celular: revisão numa tela só com faixa de lances horizontal"`

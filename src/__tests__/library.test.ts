import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseGame } from '../pgn/parse'
import { gameId } from '../library/gameId'
import { mergeGames } from '../library/merge'
import type { SavedGame } from '../library/types'
import { canReuse, noteCount, type GameRepo } from '../library/repo'
import { createLocalRepo } from '../library/localRepo'
import { savedDate } from '../library/format'
import { createNoteSaver } from '../library/noteSaver'
import { isFirebaseConfigured } from '../library/firebaseConfig'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const lichessGame = `[Event "Rated Blitz game"]
[White "carol"]
[Black "dave"]
[Result "1/2-1/2"]

1. e4 { [%clk 0:03:00] } 1... e5 { [%clk 0:03:00] } 2. Nf3 Nc6 1/2-1/2`

describe('gameId', () => {
  it('mesma partida com e sem cabeçalhos dá o mesmo id', async () => {
    const a = await gameId(parseGame(lichessGame))
    const b = await gameId(parseGame('1. e4 e5 2. Nf3 Nc6 *'))
    expect(a).toBe(b)
  })

  it('posição inicial diferente muda o id', async () => {
    const fen = '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1'
    const a = await gameId(parseGame('1. e4 *'))
    const b = await gameId(parseGame(`[SetUp "1"]\n[FEN "${fen}"]\n\n1. e4 *`))
    expect(a).not.toBe(b)
  })

  it('id tem 20 caracteres hex', async () => {
    expect(await gameId(parseGame('1. e4 *'))).toMatch(/^[0-9a-f]{20}$/)
  })
})

function make(partial: Partial<SavedGame>): SavedGame {
  return {
    id: 'g',
    pgn: '1. e4 *',
    headers: {},
    depth: 16,
    evals: [],
    analyzedAt: 1,
    createdAt: 1,
    updatedAt: 1,
    notes: {},
    ...partial,
  }
}

const texts = (g: SavedGame) => Object.fromEntries(Object.entries(g.notes).map(([k, n]) => [k, n.text]))

describe('mergeGames', () => {
  const a = make({ notes: { 3: { text: 'A', updatedAt: 10 }, 5: { text: 'x', updatedAt: 1 } } })
  const b = make({ notes: { 3: { text: 'B', updatedAt: 20 }, 7: { text: 'y', updatedAt: 1 } } })

  it('nota mais recente vence por ply', () => {
    expect(texts(mergeGames(a, b))).toEqual({ 3: 'B', 5: 'x', 7: 'y' })
  })

  it('é simétrica nas notas', () => {
    expect(mergeGames(a, b).notes).toEqual(mergeGames(b, a).notes)
  })

  it('comentário mais recente vence', () => {
    const m = mergeGames(make({ comment: { text: 'novo', updatedAt: 9 } }), make({ comment: { text: 'velho', updatedAt: 2 } }))
    expect(m.comment?.text).toBe('novo')
  })

  it('comentário ausente de um lado é mantido do outro', () => {
    expect(mergeGames(make({}), make({ comment: { text: 'c', updatedAt: 1 } })).comment?.text).toBe('c')
    expect(mergeGames(make({ comment: { text: 'c', updatedAt: 1 } }), make({})).comment?.text).toBe('c')
  })

  it('análise feita por último vence', () => {
    const evals = [{ fen: 'x', depth: 12, lines: [] }]
    const m = mergeGames(make({ depth: 20, analyzedAt: 1 }), make({ depth: 12, analyzedAt: 2, evals }))
    expect(m.depth).toBe(12)
    expect(m.evals).toBe(evals)
  })

  it('createdAt é o menor, updatedAt o maior', () => {
    const m = mergeGames(make({ createdAt: 5, updatedAt: 6 }), make({ createdAt: 2, updatedAt: 9 }))
    expect([m.createdAt, m.updatedAt]).toEqual([2, 9])
  })
})

describe('localRepo', () => {
  const repo = createLocalRepo('teste') as GameRepo
  const input = (depth: number) => ({
    id: 'g1',
    pgn: '1. e4 *',
    headers: { White: 'alice' },
    depth,
    evals: [{ fen: 'a', depth, lines: [] }],
  })
  beforeEach(() => repo.clear())

  it('saveAnalysis cria e get devolve', async () => {
    await repo.saveAnalysis(input(14))
    const g = await repo.get('g1')
    expect(g?.depth).toBe(14)
    expect(g?.pgn).toBe('1. e4 *')
    expect(g?.evals).toHaveLength(1)
  })

  it('list não traz evals nem pgn', async () => {
    await repo.saveAnalysis(input(14))
    const [meta] = await repo.list()
    expect(meta.id).toBe('g1')
    expect('evals' in meta).toBe(false)
    expect('pgn' in meta).toBe(false)
  })

  it('reanalisar preserva notas', async () => {
    await repo.saveAnalysis(input(14))
    await repo.saveNote('g1', 3, 'oi')
    await repo.saveAnalysis(input(18))
    const g = await repo.get('g1')
    expect(g?.depth).toBe(18)
    expect(g?.notes[3].text).toBe('oi')
  })

  it('nota vazia remove', async () => {
    await repo.saveAnalysis(input(14))
    await repo.saveNote('g1', 3, 'oi')
    await repo.saveNote('g1', 3, '  ')
    const [meta] = await repo.list()
    expect(meta.notes[3]).toBeUndefined()
    expect(noteCount(meta)).toBe(0)
  })

  it('comentário salva e vazio remove', async () => {
    await repo.saveAnalysis(input(14))
    await repo.saveComment('g1', 'boa partida')
    expect((await repo.get('g1'))?.comment?.text).toBe('boa partida')
    await repo.saveComment('g1', '')
    expect((await repo.get('g1'))?.comment).toBeUndefined()
  })

  it('saveNote em partida inexistente não cria nada', async () => {
    await repo.saveNote('nope', 1, 'x')
    expect(await repo.get('nope')).toBeNull()
  })

  it('list ordena por updatedAt desc', async () => {
    await repo.saveAnalysis({ ...input(14), id: 'velha' })
    await new Promise((r) => setTimeout(r, 5))
    await repo.saveAnalysis({ ...input(14), id: 'nova' })
    expect((await repo.list()).map((m) => m.id)).toEqual(['nova', 'velha'])
  })

  it('remove apaga metadados e evals', async () => {
    await repo.saveAnalysis(input(14))
    await repo.remove('g1')
    expect(await repo.get('g1')).toBeNull()
    expect(await repo.list()).toEqual([])
  })

  it('sem IndexedDB devolve null', () => {
    vi.stubGlobal('indexedDB', undefined)
    try {
      expect(createLocalRepo('sem')).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('canReuse', () => {
  const game = parseGame('1. e4 e5 *')
  it('aceita evals com uma avaliação por posição', () => {
    expect(canReuse(make({ evals: [0, 1, 2].map((i) => ({ fen: String(i), depth: 1, lines: [] })) }), game)).toBe(true)
  })
  it('recusa evals de tamanho errado', () => {
    expect(canReuse(make({ evals: [{ fen: 'x', depth: 1, lines: [] }] }), game)).toBe(false)
  })
})

describe('parseGame guarda o texto', () => {
  it('pgn é o texto da partida', () => {
    expect(parseGame('1. e4 e5 *').pgn).toBe('1. e4 e5 *')
  })
})

describe('savedDate', () => {
  const now = new Date(2026, 9, 21, 15, 0).getTime()
  it('hoje, ontem e data curta', () => {
    expect(savedDate(new Date(2026, 9, 21, 1, 0).getTime(), now)).toBe('hoje')
    expect(savedDate(new Date(2026, 9, 20, 23, 0).getTime(), now)).toBe('ontem')
    expect(savedDate(new Date(2026, 9, 12).getTime(), now)).toBe('12 out')
  })
  it('ano aparece quando não é o atual', () => {
    expect(savedDate(new Date(2025, 0, 3).getTime(), now)).toBe('3 jan 2025')
  })
})

describe('noteSaver', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())
  const setup = () => {
    const calls: [number | 'comment', string][] = []
    const saver = createNoteSaver(async (k, t) => {
      calls.push([k, t])
    })
    return { calls, saver }
  }

  it('grava uma vez após 1000 ms com o último texto', async () => {
    const { calls, saver } = setup()
    saver.set(3, 'a')
    saver.set(3, 'ab')
    await vi.advanceTimersByTimeAsync(999)
    expect(calls).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(calls).toEqual([[3, 'ab']])
  })

  it('chaves diferentes gravam separadas', async () => {
    const { calls, saver } = setup()
    saver.set(3, 'a')
    saver.set('comment', 'c')
    await vi.advanceTimersByTimeAsync(1000)
    expect(calls).toEqual(expect.arrayContaining([[3, 'a'], ['comment', 'c']]))
    expect(calls).toHaveLength(2)
  })

  it('flush grava na hora o pendente', async () => {
    const { calls, saver } = setup()
    saver.set(3, 'a')
    expect(saver.pending()).toBe(true)
    await saver.flush()
    expect(calls).toEqual([[3, 'a']])
    expect(saver.pending()).toBe(false)
    await vi.advanceTimersByTimeAsync(1000)
    expect(calls).toHaveLength(1)
  })
})

describe('Firebase sob demanda', () => {
  it('sem config preenchida, login fica desligado', () => {
    expect(isFirebaseConfigured()).toBe(false)
  })

  it('só src/library/firebase.ts importa o SDK estaticamente', () => {
    const root = new URL('..', import.meta.url).pathname
    const files = (readdirSync(root, { recursive: true }) as string[]).filter((f) => /\.tsx?$/.test(f))
    const offenders = files.filter(
      (f) => f !== join('library', 'firebase.ts') && /from ['"]firebase/.test(readFileSync(join(root, f), 'utf8')),
    )
    expect(offenders).toEqual([])
  })
})

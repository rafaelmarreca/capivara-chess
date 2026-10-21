import { describe, expect, it } from 'vitest'
import { parseGame } from '../pgn/parse'
import { gameId } from '../library/gameId'
import { mergeGames } from '../library/merge'
import type { SavedGame } from '../library/types'

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

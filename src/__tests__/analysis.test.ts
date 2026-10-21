import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parsePgnFile, splitPgn } from '../pgn/parse'
import { winPercentFor, winPercentWhite, formatScore } from '../analysis/winPercent'
import { moveAccuracy, gameAccuracy } from '../analysis/accuracy'
import { classifyMove, type ClassifyInput } from '../analysis/classify'
import { isSacrifice } from '../analysis/sacrifice'
import { isBookPosition, openingName } from '../analysis/book'
import { buildAnalysis, positionsOf, terminalEval } from '../analysis/analyzeGame'
import { parseInfo } from '../engine/stockfish'

const sample = readFileSync(new URL('../../public/samples/exemplo.pgn', import.meta.url), 'utf8')

const lichessPgn = `[Event "Rated Blitz game"]
[Site "https://lichess.org/abcd1234"]
[White "alice"]
[Black "bob"]
[Result "0-1"]
[WhiteElo "1500"]
[BlackElo "1520"]

1. f3 { [%eval -0.5] [%clk 0:03:00] } 1... e5 { [%eval -0.4] [%clk 0:03:00] } 2. g4 { [%clk 0:02:58] } 2... Qh4# { [%clk 0:02:57] } 0-1

[Event "Rated Blitz game"]
[White "carol"]
[Black "dave"]
[Result "1/2-1/2"]

1. e4 e5 2. Nf3 Nc6 1/2-1/2
`

describe('parse', () => {
  it('separa várias partidas e lê relógio', () => {
    expect(splitPgn(lichessPgn)).toHaveLength(2)
    const [g1, g2] = parsePgnFile(lichessPgn)
    expect(g1.headers.White).toBe('alice')
    expect(g1.moves.map((m) => m.san)).toEqual(['f3', 'e5', 'g4', 'Qh4#'])
    expect(g1.moves[0].clock).toBe('0:03:00')
    expect(g1.moves[3].uci).toBe('d8h4')
    expect(g2.moves).toHaveLength(4)
  })

  it('aceita comentários consecutivos e após o número do lance', () => {
    const pgn = '1. e4 { [%eval 0.2] } { [%clk 0:03:00] } 1... { x } e5 { a } { b } { c } 2. Nf3 1-0'
    const [g] = parsePgnFile(pgn)
    expect(g.moves.map((m) => m.san)).toEqual(['e4', 'e5', 'Nf3'])
    expect(g.moves[0].clock).toBe('0:03:00')
  })
})

describe('winPercent', () => {
  it('é simétrico e trata mate', () => {
    expect(winPercentWhite({ cp: 0 })).toBeCloseTo(50)
    expect(winPercentWhite({ cp: 300 }) + winPercentWhite({ cp: -300 })).toBeCloseTo(100)
    expect(winPercentFor({ mate: 3 }, 'b')).toBe(0)
    expect(formatScore({ cp: 123 })).toBe('+1.2')
    expect(formatScore({ mate: -2 })).toBe('-M2')
  })
})

describe('accuracy', () => {
  it('cai com a perda', () => {
    expect(moveAccuracy(0)).toBe(100)
    expect(moveAccuracy(30)).toBeLessThan(30)
    expect(gameAccuracy([50, 50, 50], [100, 100], [0, 1])).toBeCloseTo(100)
  })
})

describe('classify', () => {
  const base: ClassifyInput = {
    isBook: false,
    legalMoves: 20,
    isBest: false,
    isSacrifice: false,
    winBefore: 60,
    winAfter: 60,
  }
  it.each<[Partial<ClassifyInput>, string]>([
    [{ isBook: true }, 'book'],
    [{ legalMoves: 1 }, 'forced'],
    [{ isSacrifice: true, isBest: true }, 'brilliant'],
    [{ isBest: true, secondBestWin: 40 }, 'great'],
    [{ isBest: true, secondBestWin: 58 }, 'best'],
    [{ winAfter: 59 }, 'excellent'],
    [{ winAfter: 57 }, 'good'],
    [{ winAfter: 52 }, 'inaccuracy'],
    [{ winAfter: 45 }, 'mistake'],
    [{ winAfter: 30 }, 'blunder'],
    [{ winBefore: 80, winAfter: 55, previousOpponent: 'blunder' }, 'miss'],
    [{ isSacrifice: true, winBefore: 99, winAfter: 99 }, 'excellent'],
    [{ isSacrifice: true, isBest: true, winBefore: 100, winAfter: 100, mateOnlyViaBest: true }, 'brilliant'],
  ])('%o -> %s', (over, expected) => {
    expect(classifyMove({ ...base, ...over })).toBe(expected)
  })
})

describe('sacrifice', () => {
  it('detecta dama entregue (Qb8+ na Partida da Ópera)', () => {
    const game = parsePgnFile(sample)[0]
    const qb8 = game.moves.find((m) => m.san === 'Qb8+')!
    expect(isSacrifice(qb8.fenBefore, qb8.uci)).toBe(true)
  })
  it('troca simples não é sacrifício', () => {
    const game = parsePgnFile(sample)[0]
    const bxf3 = game.moves.find((m) => m.san === 'Bxf3')!
    expect(isSacrifice(bxf3.fenBefore, bxf3.uci)).toBe(false)
  })
})

describe('book', () => {
  it('reconhece posições de abertura', () => {
    const game = parsePgnFile(sample)[0]
    expect(isBookPosition(game.moves[0].fenAfter)).toBe(true)
    expect(openingName(game.moves[3].fenAfter)?.name).toMatch(/Philidor/)
  })
})

describe('buildAnalysis', () => {
  it('monta a análise com avaliações sintéticas', () => {
    const game = parsePgnFile(lichessPgn)[0]
    const fens = positionsOf(game)
    const evals = fens.map(
      (fen, i) =>
        terminalEval(fen) ?? {
          fen,
          depth: 10,
          lines: [{ score: { cp: i === 3 ? -2000 : 0 }, pv: [i === 2 ? 'g1f3' : 'd8h4'] }],
        },
    )
    const a = buildAnalysis(game, evals, 10)
    expect(a.moves[2].classification).toBe('blunder') // 2. g4??
    expect(a.moves[3].classification).toBe('best') // Qh4#
    expect(a.black.accuracy).toBeGreaterThan(a.white.accuracy)
  })
})

describe('parseInfo', () => {
  it('converte para o ponto de vista das brancas', () => {
    const l = 'info depth 12 seldepth 18 multipv 2 score cp 35 nodes 1 nps 1 pv e7e5 g1f3'
    expect(parseInfo(l, false)).toMatchObject({ depth: 12, multipv: 2, score: { cp: -35 }, pv: ['e7e5', 'g1f3'] })
  })
})

import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import type { Classification, PositionEval, Score } from '../types'
import { detectMotifs, forkTargets, materialSwing, type ExplainInput } from '../analysis/explain'

const ev = (score: Score, pv: string[]): PositionEval => ({ fen: '', depth: 16, lines: [{ score, pv }] })

function input(fenBefore: string, uci: string, classification: Classification, before: PositionEval, after: PositionEval): ExplainInput {
  const chess = new Chess(fenBefore)
  const color = chess.turn()
  chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
  return { fenBefore, fenAfter: chess.fen(), uci, color, classification, before, after }
}

const HANGS = '4k3/8/8/8/1b6/8/8/3N2K1 w - - 0 1'
const DEFENDED = '4k3/8/8/8/1b6/8/1P6/3N2K1 w - - 0 1'
const QUEEN = '4k3/8/8/3q4/8/2N5/8/4K3 w - - 0 1'

describe('materialSwing', () => {
  it('captura sem retomada perde a peça', () => {
    const fen = input(HANGS, 'd1c3', 'blunder', ev({ cp: 0 }, []), ev({ cp: 0 }, [])).fenAfter
    expect(materialSwing(fen, ['b4c3'], 'w')).toBe(-3)
  })
  it('troca equilibrada dá zero', () => {
    const fen = input(DEFENDED, 'd1c3', 'good', ev({ cp: 0 }, []), ev({ cp: 0 }, [])).fenAfter
    expect(materialSwing(fen, ['b4c3', 'b2c3'], 'w')).toBe(0)
  })
})

describe('forkTargets', () => {
  it('cavalo que ataca rei e torre', () => {
    expect(forkTargets('4k3/8/8/8/1n6/8/8/R3K3 b - - 0 1', 'b4c2').sort()).toEqual(['k', 'r'])
  })
  it('um alvo só não é garfo', () => {
    expect(forkTargets('4k3/8/8/8/1n6/8/8/4K3 b - - 0 1', 'b4c2')).toEqual([])
  })
})

describe('detectMotifs', () => {
  it('peça entregue de graça', () => {
    const m = detectMotifs(input(HANGS, 'd1c3', 'blunder', ev({ cp: 0 }, ['g1f2']), ev({ cp: -300 }, ['b4c3'])))
    expect(m).toEqual([{ kind: 'hangs', piece: 'n', square: 'c3', captureSan: 'Bxc3', loss: 3, defended: false }])
  })

  it('troca equilibrada não é entregar', () => {
    expect(detectMotifs(input(DEFENDED, 'd1c3', 'good', ev({ cp: 0 }, ['g1f2']), ev({ cp: 0 }, ['b4c3', 'b2c3'])))).toEqual([])
  })

  it('já perdia a peça de qualquer jeito', () => {
    const fen = '4k3/8/8/8/1b6/2N5/8/6K1 w - - 0 1'
    expect(detectMotifs(input(fen, 'g1f1', 'mistake', ev({ cp: -300 }, ['g1h1', 'b4c3']), ev({ cp: -300 }, ['b4c3'])))).toEqual([])
  })

  it('captura grátis perdida', () => {
    const m = detectMotifs(input(QUEEN, 'e1e2', 'blunder', ev({ cp: 900 }, ['c3d5']), ev({ cp: 0 }, ['d5d4'])))
    expect(m).toEqual([{ kind: 'missedCapture', piece: 'q', square: 'd5', bestSan: 'Nxd5', gain: 9 }])
  })

  it('lance bom que ganha material', () => {
    expect(detectMotifs(input(QUEEN, 'c3d5', 'best', ev({ cp: 900 }, ['c3d5']), ev({ cp: 900 }, ['e8d7'])))).toEqual([
      { kind: 'wins', gain: 9 },
    ])
  })

  it('mate permitido', () => {
    const fen = '3r2k1/5ppp/8/8/8/8/3R1PPP/6K1 w - - 0 1'
    const m = detectMotifs(input(fen, 'd2a2', 'blunder', ev({ cp: 0 }, ['g1f1']), ev({ mate: -1 }, ['d8d1'])))
    expect(m[0]).toEqual({ kind: 'allowedMate', mateIn: 1, firstSan: 'Rd1#' })
  })

  it('mate já inevitável não é culpa do lance', () => {
    const fen = '3r2k1/5ppp/8/8/8/8/3R1PPP/6K1 w - - 0 1'
    const m = detectMotifs(input(fen, 'd2a2', 'mistake', ev({ mate: -2 }, ['g1f1']), ev({ mate: -1 }, ['d8d1'])))
    expect(m.some((x) => x.kind === 'allowedMate')).toBe(false)
  })

  it('mate perdido', () => {
    const fen = '6k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1'
    const m = detectMotifs(input(fen, 'g1f1', 'miss', ev({ mate: 1 }, ['d1d8']), ev({ cp: 500 }, ['g8f8'])))
    expect(m[0]).toEqual({ kind: 'missedMate', mateIn: 1, bestSan: 'Rd8#' })
  })

  it('garfo permitido, sem repetir como peça entregue', () => {
    const fen = '4k3/8/8/8/1n6/8/7P/R3K3 w - - 0 1'
    const m = detectMotifs(input(fen, 'h2h3', 'blunder', ev({ cp: 0 }, ['a1a4']), ev({ cp: -500 }, ['b4c2', 'e1d2', 'c2a1'])))
    expect(m).toHaveLength(1)
    expect(m[0]).toMatchObject({ kind: 'allowedFork', forkSan: 'Nc2+', loss: 5 })
    expect((m[0] as { targets: string[] }).targets.sort()).toEqual(['k', 'r'])
  })

  it('garfo perdido', () => {
    const fen = 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1'
    const m = detectMotifs(input(fen, 'e1e2', 'mistake', ev({ cp: 500 }, ['b5c7', 'e8d7', 'c7a8']), ev({ cp: 0 }, ['a8a5'])))
    expect(m[0]).toMatchObject({ kind: 'missedFork', forkSan: 'Nc7+', gain: 5 })
  })

  it('pv vazia ou ilegal não quebra', () => {
    expect(detectMotifs(input(HANGS, 'd1c3', 'blunder', ev({ cp: 0 }, []), ev({ cp: -300 }, [])))).toEqual([])
    expect(detectMotifs(input(HANGS, 'd1c3', 'blunder', ev({ cp: 0 }, ['a1a1']), ev({ cp: -300 }, ['h8h1'])))).toEqual([])
    expect(detectMotifs({ ...input(HANGS, 'd1c3', 'blunder', ev({ cp: 0 }, []), ev({ cp: 0 }, [])), after: { fen: '', depth: 0, lines: [] } })).toEqual([])
  })
})

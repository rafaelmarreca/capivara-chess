import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import type { Classification, PositionEval, Score } from '../types'
import { detectMotifs, type ExplainInput } from '../analysis/explain'
import { bestReason } from '../analysis/bestReason'
import { explainBest, plainText } from '../ui/explainText'

const ev = (score: Score, pv: string[]): PositionEval => ({ fen: '', depth: 16, lines: [{ score, pv }] })

function input(fenBefore: string, uci: string, classification: Classification, before: PositionEval, after: PositionEval): ExplainInput {
  const chess = new Chess(fenBefore)
  const color = chess.turn()
  chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
  return { fenBefore, fenAfter: chess.fen(), uci, color, classification, before, after }
}
const why = (i: ExplainInput) => {
  const r = bestReason(i, detectMotifs(i))
  return r && plainText(explainBest(r))
}

describe('por que o melhor lance era melhor', () => {
  it('tirava a peça do ataque', () => {
    const i = input('4k3/8/8/8/1b6/2N5/8/6K1 w - - 0 1', 'g1f1', 'mistake', ev({ cp: 0 }, ['c3e4']), ev({ cp: -300 }, ['b4c3']))
    expect(why(i)).toBe('Ne4 tirava o cavalo do ataque.')
  })

  it('defendia a peça', () => {
    const i = input('4k3/8/8/8/1b6/2N5/8/3R2K1 w - - 0 1', 'g1f1', 'mistake', ev({ cp: 0 }, ['d1d3']), ev({ cp: -300 }, ['b4c3']))
    expect(why(i)).toBe('Rd3 defendia o cavalo em c3.')
  })

  it('ganhava material (sem repetir "perdeu a chance de capturar")', () => {
    const fen = '4k3/8/8/3q4/8/2N5/8/4K3 w - - 0 1'
    expect(why(input(fen, 'e1e2', 'inaccuracy', ev({ cp: 900 }, ['c3d5']), ev({ cp: 0 }, ['d5d4'])))).toBe('Nxd5 ganhava a dama.')
    // erro com "perdeu a chance de capturar" já explica o melhor lance: nada a mais
    expect(why(input(fen, 'e1e2', 'blunder', ev({ cp: 900 }, ['c3d5']), ev({ cp: 0 }, ['d5d4'])))).toBeNull()
  })

  it('dava mate', () => {
    const i = input('6k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1', 'g1f1', 'inaccuracy', ev({ mate: 1 }, ['d1d8']), ev({ cp: 500 }, ['g8f8']))
    expect(why(i)).toBe('Rd8# dava mate.')
  })

  it('evitava o mate', () => {
    const i = input('3r2k1/5ppp/8/8/8/8/3R1PPP/6K1 w - - 0 1', 'd2a2', 'blunder', ev({ cp: 0 }, ['d2d1']), ev({ mate: -1 }, ['d8d1']))
    expect(why(i)).toBe('Rd1 evitava o mate.')
  })

  it('motivo posicional, no passado', () => {
    const i = input(new Chess().fen(), 'a2a3', 'inaccuracy', ev({ cp: 30 }, ['e2e4']), ev({ cp: 0 }, ['e7e5']))
    expect(why(i)).toBe('e4 abria a diagonal do bispo de f1.')
  })

  it('sem regra: diferença de avaliação', () => {
    const i = input('4k3/8/8/8/8/8/P7/4K3 w - - 0 1', 'e1d1', 'inaccuracy', ev({ cp: 50 }, ['e1e2']), ev({ cp: 20 }, ['e8d7']))
    // A avaliação é sempre do ponto de vista das brancas, como na barra: a frase não diz "melhor" nem "pior"
    expect(why(i)).toBe('Com Ke2, a avaliação ficava em +0.5, em vez de +0.2.')
  })

  it('lance jogado era o melhor: nada', () => {
    const i = input(new Chess().fen(), 'e2e4', 'best', ev({ cp: 30 }, ['e2e4']), ev({ cp: 30 }, ['e7e5']))
    expect(bestReason(i, detectMotifs(i))).toBeNull()
  })
})

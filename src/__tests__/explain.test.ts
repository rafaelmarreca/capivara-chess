import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import type { Classification, PositionEval, Score } from '../types'
import { detectMotifs, forkTargets, materialSwing, type ExplainInput, type Motif } from '../analysis/explain'
import { explainMotif, plainText, subjectFor } from '../ui/explainText'

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

describe('explainMotif', () => {
  const say = (m: Motif, subject: 'you' | 'w' | 'b', color: 'w' | 'b' = 'w') => plainText(explainMotif(m, subject, color))
  const hangs: Motif = { kind: 'hangs', piece: 'n', square: 'c3', captureSan: 'Bxc3', loss: 3, defended: false }

  it('você = lado de baixo do tabuleiro', () => {
    expect(subjectFor('w', 'white')).toBe('you')
    expect(subjectFor('w', 'black')).toBe('w')
    expect(subjectFor('b', 'black')).toBe('you')
  })

  it('peça entregue, em 2ª e 3ª pessoa', () => {
    expect(say(hangs, 'you')).toBe('Você deixou o cavalo em c3 sem defesa: depois de Bxc3, você fica uma peça atrás.')
    expect(say(hangs, 'w')).toBe(
      'As brancas deixaram o cavalo em c3 sem defesa: depois de Bxc3, as brancas ficam uma peça atrás.',
    )
    expect(say({ ...hangs, piece: 'q', square: 'd4', defended: true, loss: 6 }, 'you')).toBe(
      'Você deixou a dama em d4 mal defendida: depois de Bxc3, você fica uma torre atrás.',
    )
  })

  it('captura perdida', () => {
    expect(say({ kind: 'missedCapture', piece: 'q', square: 'd5', bestSan: 'Nxd5', gain: 9 }, 'you')).toBe(
      'Você perdeu a chance de capturar a dama em d5 com Nxd5.',
    )
  })

  it('mate permitido e perdido', () => {
    expect(say({ kind: 'allowedMate', mateIn: 1, firstSan: 'Rd1#' }, 'you')).toBe('Depois disso, as pretas dão mate com Rd1#.')
    expect(say({ kind: 'allowedMate', mateIn: 3, firstSan: 'Qh4+' }, 'w')).toBe(
      'Depois disso, as pretas dão mate em 3, começando com Qh4+.',
    )
    expect(say({ kind: 'missedMate', mateIn: 1, bestSan: 'Rd8#' }, 'you')).toBe('Você tinha mate com Rd8#.')
    expect(say({ kind: 'missedMate', mateIn: 2, bestSan: 'Qg7+' }, 'b', 'b')).toBe(
      'As pretas tinham mate em 2, começando com Qg7+.',
    )
  })

  it('garfos', () => {
    expect(say({ kind: 'allowedFork', forkSan: 'Nc2+', targets: ['k', 'r'], loss: 5 }, 'you')).toBe(
      'Isso permite Nc2+, um garfo no rei e na torre.',
    )
    expect(say({ kind: 'missedFork', forkSan: 'Nc7+', targets: ['k', 'r', 'q'], gain: 5 }, 'you')).toBe(
      'Você tinha Nc7+, um garfo no rei, na torre e na dama.',
    )
  })

  it('lance bom', () => {
    expect(say({ kind: 'wins', gain: 9 }, 'you')).toBe('Ganha a dama.')
    expect(say({ kind: 'wins', gain: 1 }, 'you')).toBe('Ganha um peão.')
    expect(say({ kind: 'wins', gain: 0, mateIn: 2 }, 'you')).toBe('Leva a mate em 2.')
  })

  it('lance vira segmento SAN para a notação figurada', () => {
    expect(explainMotif(hangs, 'you', 'w')).toContainEqual({ san: 'Bxc3' })
  })
})

describe('detectMotifs não afirma o que não aconteceu', () => {
  it('troca cortada no meio da janela é contada até o fim', () => {
    const fen = '3rk3/p6p/8/8/8/8/P2R3P/4K3 w - - 0 1'
    expect(materialSwing(fen, ['a2a3', 'a7a6', 'h2h3', 'h7h6', 'a3a4', 'd8d2', 'e1d2'], 'w')).toBe(0)
  })

  it('lance bom não recebe motivo negativo', () => {
    expect(detectMotifs(input(HANGS, 'd1c3', 'good', ev({ cp: 0 }, ['g1f2']), ev({ cp: -300 }, ['b4c3'])))).toEqual([])
  })

  it('só diz "fica atrás" se o saldo real for negativo, não só pior que a melhor linha', () => {
    // a melhor linha ganharia a dama; a jogada não perde nada de fato
    const m = detectMotifs(input(QUEEN, 'e1e2', 'blunder', ev({ cp: 900 }, ['c3d5']), ev({ cp: 0 }, ['d5d4'])))
    expect(m.some((x) => x.kind === 'hangs')).toBe(false)
  })

  it('retomada não "ganha" material', () => {
    // as pretas acabaram de tomar o cavalo em c3; bxc3 só recupera a peça
    const fen = '4k3/8/8/8/8/2b5/1P6/6K1 w - - 0 1'
    expect(detectMotifs({ ...input(fen, 'b2c3', 'best', ev({ cp: 0 }, ['b2c3']), ev({ cp: 0 }, ['e8d7'])), previousCaptured: 3 })).toEqual([])
  })

  it('lance que não captura não "ganha" material', () => {
    const fen = '4k3/8/8/3q4/8/2N5/8/4K3 w - - 0 1'
    expect(detectMotifs(input(fen, 'e1f2', 'best', ev({ cp: 900 }, ['e1f2']), ev({ cp: 900 }, ['d5e4', 'c3e4'])))).toEqual([])
  })
})

describe('peça mais valiosa perdida na linha', () => {
  it('Blackburne-Shilling: Nxf7 perde a torre em h1, não "o peão em g2"', () => {
    const chess = new Chess()
    for (const san of ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4', 'Nxe5', 'Qg5']) chess.move(san)
    const m = detectMotifs(
      input(
        chess.fen(),
        'e5f7',
        'blunder',
        ev({ cp: -72 }, 'c4f7 e8d8 e1g1 g5e5 d2d3 e5f6'.split(' ')),
        ev({ cp: -472 }, 'g5g2 b1c3 g2h1 c4f1 g8h6 f7h6'.split(' ')),
      ),
    )
    expect(m[0]).toMatchObject({ kind: 'losesPiece', piece: 'r', square: 'h1', firstSan: 'Qxg2' })
  })

  it('frase da peça perdida', () => {
    expect(plainText(explainMotif({ kind: 'losesPiece', piece: 'r', square: 'h1', firstSan: 'Qxg2', loss: 3 }, 'you', 'w'))).toBe(
      'Isso permite Qxg2, e as pretas ganham a torre em h1: você fica uma peça atrás.',
    )
  })
})

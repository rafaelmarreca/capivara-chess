import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import type { Classification, PositionEval, Score } from '../types'
import { capturedSquare, detectMotifs, forkTargets, materialSwing, type ExplainInput, type Motif } from '../analysis/explain'
import { explainMotif, plainText, subjectFor } from '../ui/explainText'
import { parseGame } from '../pgn/parse'
import { buildAnalysis } from '../analysis/analyzeGame'

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
    expect(m).toEqual([
      { kind: 'hangs', piece: 'n', square: 'c3', captureSan: 'Bxc3', loss: 3, defended: false, arrow: { from: 'b4', to: 'c3' } },
    ])
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
    expect(m[0]).toEqual({ kind: 'allowedMate', mateIn: 1, firstSan: 'Rd1#', arrow: { from: 'd8', to: 'd1' } })
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
    expect(say(hangs, 'you')).toBe('Você deixou o cavalo em c3 sem defesa: depois de Bxc3, você perde uma peça.')
    expect(say(hangs, 'w')).toBe('As brancas deixaram o cavalo em c3 sem defesa: depois de Bxc3, as brancas perdem uma peça.')
    expect(say({ ...hangs, piece: 'q', square: 'd4', defended: true, loss: 6 }, 'you')).toBe(
      'Você deixou a dama em d4 mal defendida: depois de Bxc3, você perde 6 pontos de material.',
    )
  })

  it('captura perdida', () => {
    expect(say({ kind: 'missedCapture', piece: 'q', square: 'd5', bestSan: 'Nxd5', gain: 9 }, 'you')).toBe(
      'Você perdeu a chance de capturar a dama em d5 com Nxd5.',
    )
  })

  it('mate permitido e perdido', () => {
    expect(say({ kind: 'allowedMate', mateIn: 1, firstSan: 'Rd1#' }, 'you')).toBe('Depois disso, as pretas dão mate com Rd1#.')
    expect(say({ kind: 'allowedMate', mateIn: 3, firstSan: 'Qh4+' }, 'you')).toBe(
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
  // Pela linha da engine o cavalo já estava perdido também na melhor (Bxf7+ Kd8 O-O Qxe5): no saldo,
  // Nxf7 não perde material a mais, então não há frase concreta verdadeira — e nunca "o peão em g2".
  it('Blackburne-Shilling: Nxf7 não vira "deixou o peão em g2"', () => {
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
    expect(m.some((x) => 'square' in x && x.square === 'g2')).toBe(false)
  })

  it('frase da peça perdida', () => {
    expect(plainText(explainMotif({ kind: 'losesPiece', piece: 'r', square: 'h1', firstSan: 'Qxg2', loss: 3 }, 'you', 'w'))).toBe(
      'Isso permite Qxg2, e as pretas ganham a torre em h1: no saldo, você perde uma peça.',
    )
  })
})

describe('correções da revisão', () => {
  it('troca de damas antes da perda real: culpa o cavalo, não a dama', () => {
    const fen = '6k1/5ppp/8/4p3/1b1q4/2N5/5PPP/3QR1K1 w - - 0 1'
    const m = detectMotifs(input(fen, 'h2h3', 'blunder', ev({ cp: 0 }, 'd1d4 e5d4 c3e2'.split(' ')), ev({ cp: -300 }, 'd4d1 e1d1 b4c3 g2g3'.split(' '))))
    expect(m[0]).toMatchObject({ kind: 'losesPiece', piece: 'n', square: 'c3' })
  })

  it('não diz "fica atrás" (o jogador pode continuar à frente)', () => {
    const hangs: Motif = { kind: 'hangs', piece: 'n', square: 'c3', captureSan: 'Bxc3', loss: 3, defended: false }
    expect(plainText(explainMotif(hangs, 'you', 'w'))).toBe('Você deixou o cavalo em c3 sem defesa: depois de Bxc3, você perde uma peça.')
    expect(plainText(explainMotif({ kind: 'losesPiece', piece: 'r', square: 'h1', firstSan: 'Qxg2', loss: 3 }, 'you', 'w'))).toBe(
      'Isso permite Qxg2, e as pretas ganham a torre em h1: no saldo, você perde uma peça.',
    )
  })

  it('promoção no limite da janela é seguida até a retomada', () => {
    expect(materialSwing('1R5k/8/8/8/8/8/1p6/7K w - - 0 1', 'h1g2 h8h7 g2f3 h7h6 f3e4 b2b1q b8b1'.split(' '), 'w')).toBe(1)
  })

  it('en passant: a peça capturada estava em outra casa', () => {
    const chess = new Chess('4k3/8/8/8/4p3/8/3P4/4K3 w - - 0 1')
    chess.move('d4')
    expect(capturedSquare(chess.move('exd3'))).toBe('d4')
  })

  it('o adversário também vira "você" quando é o lado de baixo', () => {
    // as pretas (em cima) erram; você joga de brancas
    expect(plainText(explainMotif({ kind: 'losesPiece', piece: 'r', square: 'a8', firstSan: 'Nc7+', loss: 5 }, 'b', 'b'))).toBe(
      'Isso permite Nc7+, e você ganha a torre em a8: no saldo, as pretas perdem uma torre.',
    )
    expect(plainText(explainMotif({ kind: 'allowedMate', mateIn: 1, firstSan: 'Qh7#' }, 'b', 'b'))).toBe(
      'Depois disso, você dá mate com Qh7#.',
    )
  })
})

describe('retomada só desconta quando é na mesma casa', () => {
  it('lance que toma outra peça mantém o ganho inteiro', () => {
    const game = parseGame('[SetUp "1"]\n[FEN "4k3/8/5n2/8/1b5B/P7/8/7K b - - 0 1"]\n\n1... Bxa3 2. Bxf6 *')
    const e = (cp: number, pv: string[]) => ({ fen: '', depth: 16, lines: [{ score: { cp }, pv }] })
    const a = buildAnalysis(game, [e(0, ['b4a3']), e(-100, ['h4f6']), e(200, ['a3c5'])], 16)
    expect(a.moves[1].motifs.find((x) => x.kind === 'wins')).toEqual({ kind: 'wins', gain: 3 })
  })
})

describe('ganho de material com mate contra', () => {
  it('não diz "ganha" se depois do lance o adversário dá mate', () => {
    // pretas tomam o cavalo, mas as brancas dão mate na sequência
    expect(detectMotifs(input(QUEEN, 'c3d5', 'best', ev({ cp: 900 }, ['c3d5']), ev({ mate: -2 }, ['e8d7'])))).toEqual([])
  })
})

describe('motivos posicionais', () => {
  const quiet = (fen: string, uci: string, cls: Classification = 'good') =>
    detectMotifs(input(fen, uci, cls, ev({ cp: 0 }, []), ev({ cp: 0 }, [])))
  const after = (...sans: string[]) => {
    const c = new Chess()
    for (const s of sans) c.move(s)
    return c.fen()
  }

  it('roque', () => {
    expect(quiet(after('e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'), 'e1g1')).toEqual([
      { kind: 'castles', arrow: { from: 'e1', to: 'g1' } },
    ])
  })

  it('desenvolvimento de peça menor nos primeiros lances', () => {
    expect(quiet(new Chess().fen(), 'g1f3')).toEqual([{ kind: 'develops', piece: 'n', square: 'f3', arrow: { from: 'g1', to: 'f3' } }])
  })

  it('depois do lance 15 não é "desenvolvimento"', () => {
    expect(quiet('4k3/8/8/8/8/8/8/4K1N1 w - - 0 20', 'g1f3')).toEqual([])
  })

  it('lance de peão que abre a diagonal do bispo (como d6 no chess.com)', () => {
    expect(quiet(after('e4'), 'd7d6')).toEqual([{ kind: 'opensLine', piece: 'b', from: 'c8', to: 'h3', arrow: { from: 'c8', to: 'h3' } }])
  })

  it('peão no centro', () => {
    expect(quiet('4k3/8/8/8/8/4P3/8/4K3 w - - 0 1', 'e3e4')).toEqual([{ kind: 'centerPawn', square: 'e4' }])
  })

  it('torre na coluna aberta', () => {
    expect(quiet('4k3/pp6/8/8/8/8/PP6/R3K3 w - - 0 30', 'a1d1')).toEqual([
      { kind: 'openFile', piece: 'r', file: 'd', semi: false, arrow: { from: 'd1', to: 'd8' } },
    ])
  })

  it('peão passado criado pelo lance', () => {
    expect(quiet('4k3/8/8/2p5/3P4/8/8/4K3 w - - 0 30', 'd4c5', 'best')).toEqual([
      { kind: 'passedPawn', square: 'c5', arrow: { from: 'c5', to: 'c8' } },
    ])
  })

  it('lance ruim não recebe elogio posicional', () => {
    expect(quiet(new Chess().fen(), 'g1f3', 'mistake')).toEqual([])
    expect(quiet(new Chess().fen(), 'g1f3', 'inaccuracy')).toEqual([])
  })

  it('peão que já era passado e só andou não é "criado"', () => {
    expect(quiet('4k3/8/8/8/8/4P3/8/4K3 w - - 0 30', 'e3e4').some((m) => m.kind === 'passedPawn')).toBe(false)
  })

  it('frases', () => {
    const say = (m: Motif) => plainText(explainMotif(m, 'you', 'w'))
    expect(say({ kind: 'castles' })).toBe('Roca: o rei fica protegido e a torre entra em jogo.')
    expect(say({ kind: 'develops', piece: 'n', square: 'f3' })).toBe('Desenvolve o cavalo para f3.')
    expect(say({ kind: 'opensLine', piece: 'b', from: 'c8', to: 'h3' })).toBe('Abre a diagonal do bispo de c8.')
    expect(say({ kind: 'opensLine', piece: 'q', from: 'd1', to: 'h5' })).toBe('Abre caminho para a dama em d1.')
    expect(say({ kind: 'centerPawn', square: 'e4' })).toBe('Ocupa o centro com o peão em e4.')
    expect(say({ kind: 'openFile', piece: 'r', file: 'd', semi: false })).toBe('A torre ocupa a coluna aberta d.')
    expect(say({ kind: 'openFile', piece: 'q', file: 'c', semi: true })).toBe('A dama ocupa a coluna semiaberta c.')
    expect(say({ kind: 'passedPawn', square: 'c5' })).toBe('Cria um peão passado em c5.')
  })
})

describe('setas dos motivos táticos', () => {
  it('peça entregue: da peça que captura até a peça perdida', () => {
    const m = detectMotifs(input(HANGS, 'd1c3', 'blunder', ev({ cp: 0 }, ['g1f2']), ev({ cp: -300 }, ['b4c3'])))
    expect(m[0].arrow).toEqual({ from: 'b4', to: 'c3' })
  })
  it('mate permitido: o lance do mate', () => {
    const fen = '3r2k1/5ppp/8/8/8/8/3R1PPP/6K1 w - - 0 1'
    const m = detectMotifs(input(fen, 'd2a2', 'blunder', ev({ cp: 0 }, ['g1f1']), ev({ mate: -1 }, ['d8d1'])))
    expect(m[0].arrow).toEqual({ from: 'd8', to: 'd1' })
  })
})

describe('mate em primeiro lugar (prints do usuário)', () => {
  it('o lance que dá mate diz mate, não "ganha uma torre"', () => {
    const fen = '5r1k/6pp/8/8/8/8/8/5QK1 w - - 0 1'
    const m = detectMotifs(input(fen, 'f1f8', 'best', ev({ mate: 1 }, ['f1f8']), ev({ cp: 100000 }, [])))
    expect(m).toEqual([{ kind: 'mates' }])
    expect(plainText(explainMotif({ kind: 'mates' }, 'you', 'w'))).toBe('Xeque-mate.')
  })

  it('com mate na linha, nada de contar material', () => {
    // a2a3?? deixa Rxd1# — a torre em d1 cai, mas o que importa é o mate
    const fen = '3r2k1/5ppp/8/8/8/8/P4PPP/3R2K1 w - - 0 1'
    const m = detectMotifs(input(fen, 'a2a3', 'blunder', ev({ cp: 0 }, ['d1d8', 'g8f8']), ev({ mate: -1 }, ['d8d1'])))
    expect(m.map((x) => x.kind)).toEqual(['allowedMate'])
  })

  it('material só leva nome de peça quando o valor bate', () => {
    const say = (loss: number) =>
      plainText(explainMotif({ kind: 'hangs', piece: 'r', square: 'c8', captureSan: 'Qxc8+', loss, defended: false }, 'b', 'b'))
    expect(say(5)).toContain('perdem uma torre.')
    expect(say(10)).toContain('perdem 10 pontos de material.')
    expect(say(6)).toContain('perdem 6 pontos de material.')
  })
})

describe('janela igual para saldo e perdas (linha real do Blackburne)', () => {
  it('não diz "deixou o peão em g2" quando a torre perdida é recuperada (Nxh8)', () => {
    const c = new Chess()
    for (const s of ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4', 'Nxe5', 'Qg5']) c.move(s)
    const best = 'c4f7 e8e7 e1g1 g5e5 f7g8 h8g8 c2c3 d4e6 d2d4 e5f6'.split(' ')
    const reply = 'g5g2 d2d3 g2h1 e1d2 h1g2 f7h8 g2f2 d2c3 g8f6 c4f7'.split(' ')
    const m = detectMotifs(input(c.fen(), 'e5f7', 'blunder', ev({ cp: 62 }, best), ev({ cp: -407 }, reply)))
    expect(m.some((x) => x.kind === 'hangs' && x.square === 'g2')).toBe(false)
  })

  it('peça que não explica a perda vira frase genérica', () => {
    expect(plainText(explainMotif({ kind: 'losesMaterial', firstSan: 'Qxg2', loss: 3 }, 'you', 'w'))).toBe(
      'Isso permite Qxg2: no saldo, você perde uma peça.',
    )
  })
})

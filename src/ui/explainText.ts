import type { Color, PieceSymbol } from 'chess.js'
import type { Motif } from '../analysis/explain'
import type { BestReason } from '../analysis/bestReason'
import { VALUES } from '../analysis/sacrifice'
import { formatScore } from '../analysis/winPercent'

/** Pedaço de frase: texto ou lance em SAN (renderizado com a notação figurada). */
export type Segment = string | { san: string }

/** 'you' = o lado que está embaixo no tabuleiro; senão, a cor (3ª pessoa). */
export type Subject = 'you' | Color

export function subjectFor(moveColor: Color, orientation: 'white' | 'black'): Subject {
  return (moveColor === 'w') === (orientation === 'white') ? 'you' : moveColor
}

export const plainText = (segments: Segment[]) => segments.map((s) => (typeof s === 'string' ? s : s.san)).join('')

const PIECES: Record<PieceSymbol, { name: string; fem: boolean }> = {
  p: { name: 'peão', fem: false },
  n: { name: 'cavalo', fem: false },
  b: { name: 'bispo', fem: false },
  r: { name: 'torre', fem: true },
  q: { name: 'dama', fem: true },
  k: { name: 'rei', fem: false },
}

const withArticle = (p: PieceSymbol) => `${PIECES[p].fem ? 'a' : 'o'} ${PIECES[p].name}`
const withIn = (p: PieceSymbol) => `${PIECES[p].fem ? 'na' : 'no'} ${PIECES[p].name}`

function list(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`
}

/** Material em palavras só quando o valor bate com uma peça; senão, em pontos ("10 pontos de material"). */
function amount(points: number, queen = 'uma dama'): string {
  const named: Record<number, string> = { 1: 'um peão', 2: 'dois peões', 3: 'uma peça', 5: 'uma torre', 9: queen }
  return named[points] ?? `${points} pontos de material`
}

const colorName = (c: Color) => (c === 'w' ? 'as brancas' : 'as pretas')
const capital = (s: string) => s[0].toUpperCase() + s.slice(1)

/** Frase do motivo. `moveColor` é quem jogou o lance comentado. */
export function explainMotif(m: Motif, subject: Subject, moveColor: Color): Segment[] {
  const you = subject === 'you'
  const who = you ? 'você' : colorName(moveColor)
  const Who = capital(who)
  // O adversário de quem está em cima é o lado de baixo: "você"
  const opponent = you ? colorName(moveColor === 'w' ? 'b' : 'w') : 'você'
  // 2ª pessoa no singular ("você deixou"), 3ª no plural ("as brancas deixaram")
  const verb = (sing: string, plural: string) => (you ? sing : plural)
  const oppVerb = (sing: string, plural: string) => (you ? plural : sing)
  const mateTail = (n: number, san: string): Segment[] =>
    n === 1 ? ['mate com ', { san }, '.'] : [`mate em ${n}, começando com `, { san }, '.']

  switch (m.kind) {
    case 'hangs': {
      const how = m.defended ? `mal ${PIECES[m.piece].fem ? 'defendida' : 'defendido'}` : 'sem defesa'
      return [
        `${Who} ${verb('deixou', 'deixaram')} ${withArticle(m.piece)} em ${m.square} ${how}: depois de `,
        { san: m.captureSan },
        `, ${who} ${verb('perde', 'perdem')} ${amount(m.loss)}.`,
      ]
    }
    case 'losesPiece':
      return [
        'Isso permite ',
        { san: m.firstSan },
        `, e ${opponent} ${oppVerb('ganha', 'ganham')} ${withArticle(m.piece)} em ${m.square}: no saldo, ${who} ${verb('perde', 'perdem')} ${amount(m.loss)}.`,
      ]
    case 'losesMaterial':
      return ['Isso permite ', { san: m.firstSan }, `: no saldo, ${who} ${verb('perde', 'perdem')} ${amount(m.loss)}.`]
    case 'missedCapture':
      return [
        `${Who} ${verb('perdeu', 'perderam')} a chance de capturar ${withArticle(m.piece)} em ${m.square} com `,
        { san: m.bestSan },
        '.',
      ]
    case 'allowedMate':
      return [`Depois disso, ${opponent} ${oppVerb('dá', 'dão')} `, ...mateTail(m.mateIn, m.firstSan)]
    case 'missedMate':
      return [`${Who} ${verb('tinha', 'tinham')} `, ...mateTail(m.mateIn, m.bestSan)]
    case 'allowedFork':
      return ['Isso permite ', { san: m.forkSan }, `, um garfo ${list(m.targets.map(withIn))}.`]
    case 'missedFork':
      return [`${Who} ${verb('tinha', 'tinham')} `, { san: m.forkSan }, `, um garfo ${list(m.targets.map(withIn))}.`]
    case 'mates':
      return ['Xeque-mate.']
    case 'castles':
      return ['Roca: o rei fica protegido e a torre entra em jogo.']
    case 'develops':
      return [`Desenvolve ${withArticle(m.piece)} para ${m.square}.`]
    case 'opensLine':
      return [m.piece === 'b' ? `Abre a diagonal do bispo de ${m.from}.` : `Abre caminho para a dama em ${m.from}.`]
    case 'centerPawn':
      return [`Ocupa o centro com o peão em ${m.square}.`]
    case 'openFile':
      return [`${capital(withArticle(m.piece))} ocupa a coluna ${m.semi ? 'semiaberta' : 'aberta'} ${m.file}.`]
    case 'passedPawn':
      return [`Cria um peão passado em ${m.square}.`]
    case 'wins':
      if (m.mateIn != null) return [m.mateIn === 1 ? 'Leva a mate no próximo lance.' : `Leva a mate em ${m.mateIn}.`]
      return [`Ganha ${amount(m.gain, 'a dama')}.`]
  }
}

/** Por que o melhor lance era melhor, no passado (é algo que não aconteceu). */
export function explainBest(r: BestReason): Segment[] {
  const san = { san: r.bestSan }
  switch (r.kind) {
    case 'mates':
      return [san, r.mateIn === 1 ? ' dava mate.' : ` levava a mate em ${r.mateIn}.`]
    case 'avoidsMate':
      return [san, ' evitava o mate.']
    case 'saves':
      return [san, ` tirava ${withArticle(r.piece)} do ataque.`]
    case 'defends':
      return [san, ` defendia ${withArticle(r.piece)} em ${r.square}.`]
    case 'winsMaterial':
      return [san, ` ganhava ${r.piece && VALUES[r.piece] === r.gain ? withArticle(r.piece) : amount(r.gain)}.`]
    case 'positional': {
      const m = r.motif
      const text = {
        castles: 'rocava e punha o rei em segurança',
        develops: m.kind === 'develops' ? `desenvolvia ${withArticle(m.piece)}` : '',
        opensLine: m.kind === 'opensLine' ? (m.piece === 'b' ? `abria a diagonal do bispo de ${m.from}` : `abria caminho para a dama em ${m.from}`) : '',
        centerPawn: 'ocupava o centro',
        openFile: m.kind === 'openFile' ? `colocava ${withArticle(m.piece)} na coluna ${m.semi ? 'semiaberta' : 'aberta'} ${m.file}` : '',
        passedPawn: m.kind === 'passedPawn' ? `criava um peão passado em ${m.square}` : '',
      }[m.kind]
      return [san, ` ${text}.`]
    }
    case 'evalDiff':
      return ['Com ', san, `, a avaliação ficava em ${formatScore(r.best)}, em vez de ${formatScore(r.played)}.`]
  }
}

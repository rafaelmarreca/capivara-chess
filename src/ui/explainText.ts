import type { Color, PieceSymbol } from 'chess.js'
import type { Motif } from '../analysis/explain'

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

/** Quantidade de material em palavras: "um peão", "uma peça", "uma torre", "uma dama". */
function amount(points: number, queen = 'uma dama'): string {
  if (points >= 9) return queen
  if (points >= 5) return 'uma torre'
  if (points >= 3) return 'uma peça'
  return points === 2 ? 'dois peões' : 'um peão'
}

const colorName = (c: Color) => (c === 'w' ? 'as brancas' : 'as pretas')
const capital = (s: string) => s[0].toUpperCase() + s.slice(1)

/** Frase do motivo. `moveColor` é quem jogou o lance comentado. */
export function explainMotif(m: Motif, subject: Subject, moveColor: Color): Segment[] {
  const you = subject === 'you'
  const who = you ? 'você' : colorName(moveColor)
  const Who = capital(who)
  const opponent = colorName(moveColor === 'w' ? 'b' : 'w')
  // 2ª pessoa no singular ("você deixou"), 3ª no plural ("as brancas deixaram")
  const verb = (sing: string, plural: string) => (you ? sing : plural)
  const mateTail = (n: number, san: string): Segment[] =>
    n === 1 ? ['mate com ', { san }, '.'] : [`mate em ${n}, começando com `, { san }, '.']

  switch (m.kind) {
    case 'hangs': {
      const how = m.defended ? `mal ${PIECES[m.piece].fem ? 'defendida' : 'defendido'}` : 'sem defesa'
      return [
        `${Who} ${verb('deixou', 'deixaram')} ${withArticle(m.piece)} em ${m.square} ${how}: depois de `,
        { san: m.captureSan },
        `, ${who} ${verb('fica', 'ficam')} ${amount(m.loss)} atrás.`,
      ]
    }
    case 'losesPiece':
      return [
        'Isso permite ',
        { san: m.firstSan },
        `, e ${opponent} ganham ${withArticle(m.piece)} em ${m.square}: ${who} ${verb('fica', 'ficam')} ${amount(m.loss)} atrás.`,
      ]
    case 'missedCapture':
      return [
        `${Who} ${verb('perdeu', 'perderam')} a chance de capturar ${withArticle(m.piece)} em ${m.square} com `,
        { san: m.bestSan },
        '.',
      ]
    case 'allowedMate':
      return [`Depois disso, ${opponent} dão `, ...mateTail(m.mateIn, m.firstSan)]
    case 'missedMate':
      return [`${Who} ${verb('tinha', 'tinham')} `, ...mateTail(m.mateIn, m.bestSan)]
    case 'allowedFork':
      return ['Isso permite ', { san: m.forkSan }, `, um garfo ${list(m.targets.map(withIn))}.`]
    case 'missedFork':
      return [`${Who} ${verb('tinha', 'tinham')} `, { san: m.forkSan }, `, um garfo ${list(m.targets.map(withIn))}.`]
    case 'wins':
      if (m.mateIn != null) return [m.mateIn === 1 ? 'Leva a mate no próximo lance.' : `Leva a mate em ${m.mateIn}.`]
      return [`Ganha ${amount(m.gain, 'a dama')}.`]
  }
}

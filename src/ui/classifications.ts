import type { Classification } from '../types'

export interface ClassMeta {
  label: string
  glyph: string
  color: string
  /** Frase do detalhe do lance; {san} é substituído pelo lance. */
  phrase: string
}

export const CLASS_META: Record<Classification, ClassMeta> = {
  brilliant: { label: 'Brilhante', glyph: '!!', color: '#26B5AE', phrase: '{san} é brilhante' },
  great: { label: 'Ótimo', glyph: '!', color: '#5B8FC7', phrase: '{san} é um ótimo lance' },
  best: { label: 'Melhor', glyph: '★', color: '#7FB24A', phrase: '{san} é o melhor lance' },
  excellent: { label: 'Excelente', glyph: '✓', color: '#98BC4B', phrase: '{san} é excelente' },
  good: { label: 'Bom', glyph: '✓', color: '#8FA68A', phrase: '{san} é bom' },
  book: { label: 'Livro', glyph: '≡', color: '#A68A6D', phrase: '{san} é teoria de abertura' },
  forced: { label: 'Forçado', glyph: '□', color: '#8B93A1', phrase: '{san} era o único lance' },
  inaccuracy: { label: 'Imprecisão', glyph: '?!', color: '#E8B537', phrase: '{san} é uma imprecisão' },
  mistake: { label: 'Erro', glyph: '?', color: '#E2832B', phrase: '{san} é um erro' },
  miss: { label: 'Lance perdido', glyph: '✕', color: '#E8644F', phrase: '{san} deixou escapar uma chance' },
  blunder: { label: 'Capivarada', glyph: '??', color: '#CF3A34', phrase: '{san} é uma capivarada' },
}

/** Classificações que merecem destaque no gráfico. */
export const NOTABLE: Classification[] = ['brilliant', 'great', 'miss', 'mistake', 'blunder']

import { describe, expect, it } from 'vitest'
import { mergeNames, resultFor, sideOf, toggleName } from '../library/identity'
import { subjectFor } from '../ui/explainText'

const headers = { White: 'armandosanchez', Black: 'Marreca', Result: '0-1' }

describe('identidade do jogador', () => {
  it('reconhece o lado pelo nome, sem diferenciar maiúsculas', () => {
    expect(sideOf(headers, ['marreca'])).toBe('b')
    expect(sideOf(headers, ['outro'])).toBeNull()
    expect(sideOf({}, ['marreca'])).toBeNull()
  })

  it('marcar e desmarcar um nome', () => {
    expect(toggleName([], 'Marreca')).toEqual(['marreca'])
    expect(toggleName(['marreca'], 'MARRECA ')).toEqual([])
  })

  it('juntar os nomes do aparelho e da conta', () => {
    expect(mergeNames(['marreca'], ['marreca', 'rafa_lichess'])).toEqual(['marreca', 'rafa_lichess'])
  })

  it('resultado do seu ponto de vista', () => {
    expect(resultFor(headers, 'b')).toBe('vitória')
    expect(resultFor(headers, 'w')).toBe('derrota')
    expect(resultFor({ Result: '1/2-1/2' }, 'w')).toBe('empate')
    expect(resultFor({ Result: '*' }, 'w')).toBeNull()
  })

  it('"você" nas frases é o seu lado identificado', () => {
    expect(subjectFor('b', 'b')).toBe('you')
    expect(subjectFor('w', 'b')).toBe('w')
  })
})

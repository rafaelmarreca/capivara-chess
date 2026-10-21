import { defaultPieces } from 'react-chessboard'

/** Lance em notação figurada: as letras das peças viram ícones (as mesmas peças do tabuleiro) na cor do texto. */
export function San({ san }: { san: string }) {
  return (
    <span className="whitespace-nowrap" aria-label={san}>
      {san.split(/([KQRBN])/).map((part, i) =>
        /^[KQRBN]$/.test(part) ? (
          <span key={i} aria-hidden className="figurine">
            {defaultPieces[`b${part}`]()}
          </span>
        ) : (
          <span key={i} aria-hidden>
            {part}
          </span>
        ),
      )}
    </span>
  )
}

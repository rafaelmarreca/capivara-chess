import type { AnalyzedMove, Score } from '../types'
import { formatScore } from '../analysis/winPercent'
import { CLASS_META } from '../ui/classifications'
import { ClassBadge } from './ClassBadge'
import { LineChips } from './LineChips'
import { San } from './San'
import { NoteField } from './NoteField'
import { explainMotif, subjectFor } from '../ui/explainText'

interface Props {
  move?: AnalyzedMove
  initialEval?: Score
  opening?: string
  /** Lado de baixo do tabuleiro: é o "você" das explicações. */
  orientation: 'white' | 'black'
  previewIndex: number | null
  onPreview: (index: number | null) => void
  /** Sem onNoteChange o campo de nota não aparece (partida ainda não salva). */
  note?: string
  onNoteChange?: (text: string) => void
  /** Celular: card mais enxuto e nota recolhível. */
  compact?: boolean
}

const NO_SUGGESTION = ['book', 'best', 'brilliant', 'great', 'forced']

export function MoveDetail({ move, initialEval, opening, orientation, previewIndex, onPreview, note, onNoteChange, compact }: Props) {
  if (!move) {
    return (
      <div className="rounded-medium bg-content2 p-4">
        <p className="font-medium">Posição inicial</p>
        <p className="mt-1 text-sm text-foreground-500">
          Use as setas do teclado ou clique num lance para navegar.
          {initialEval && ` Avaliação: ${formatScore(initialEval)}.`}
        </p>
      </div>
    )
  }
  const meta = CLASS_META[move.classification]
  const playedWasBest = NO_SUGGESTION.includes(move.classification)

  return (
    <div className={`rounded-medium bg-content2 ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-center gap-3">
        <ClassBadge classification={move.classification} size={28} />
        <p className="flex-1 font-semibold" style={{ color: meta.color }}>
          {meta.phrase.split('{san}').map((part, i) => (
            <span key={i}>
              {i > 0 && <San san={move.san} />}
              {part}
            </span>
          ))}
        </p>
        <span className="rounded-small bg-content3 px-2 py-0.5 text-sm font-semibold">{formatScore(move.evalAfter)}</span>
      </div>
      {move.classification === 'book' && opening && <p className="mt-2 text-sm text-foreground-500">{opening}</p>}
      {move.motifs.map((m, i) => (
        <p key={i} className="mt-2 text-sm leading-relaxed">
          {explainMotif(m, subjectFor(move.color, orientation), move.color).map((s, j) =>
            typeof s === 'string' ? <span key={j}>{s}</span> : <San key={j} san={s.san} />,
          )}
        </p>
      ))}

      {move.bestLine.length > 0 && (
        <div className="mt-3">
          <div className="mb-2 flex items-baseline gap-2 text-sm">
            {playedWasBest ? (
              <span className="text-foreground-500">Linha do motor</span>
            ) : (
              <>
                <span className="text-foreground-500">Melhor era</span>
                <span className="font-semibold" style={{ color: CLASS_META.best.color }}>
                  <San san={move.bestMoveSan ?? ''} />
                </span>
              </>
            )}
            {previewIndex != null && (
              <button
                onClick={() => onPreview(null)}
                className="ml-auto rounded-small text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus"
              >
                Voltar à partida
              </button>
            )}
          </div>
          <LineChips line={move.bestLine} active={previewIndex} onSelect={onPreview} />
        </div>
      )}

      {onNoteChange && (
        <div className={compact ? 'mt-3' : 'mt-4'}>
          <NoteField
            collapsible={compact}
            label="Sua nota"
            placeholder="O que você pensou neste lance?"
            value={note ?? ''}
            onChange={onNoteChange}
          />
        </div>
      )}
    </div>
  )
}

import type { GameAnalysis, ParsedGame } from '../types'
import { CLASSIFICATIONS } from '../analysis/analyzeGame'
import { CLASS_META } from '../ui/classifications'
import { ClassBadge } from './ClassBadge'

interface Props {
  game: ParsedGame
  analysis: GameAnalysis
}

export function Summary({ game, analysis }: Props) {
  const h = game.headers
  const players = [
    { name: h.White ?? 'Brancas', elo: h.WhiteElo, s: analysis.white, swatch: '#ECEEF0' },
    { name: h.Black ?? 'Pretas', elo: h.BlackElo, s: analysis.black, swatch: '#3A404B' },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        {players.map((p) => (
          <div key={p.name} className="rounded-medium bg-content2 p-4">
            <div className="flex items-start gap-2 text-sm">
              <span className="mt-1 h-3 w-3 shrink-0 rounded-sm ring-1 ring-foreground/20" style={{ background: p.swatch }} />
              <span className="min-w-0">
                <span className="line-clamp-2 font-medium">{p.name}</span>
                {p.elo && <span className="text-foreground-500">{p.elo}</span>}
              </span>
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{p.s.accuracy.toFixed(1)}</p>
            <p className="text-sm text-foreground-500">precisão</p>
          </div>
        ))}
      </div>

      {analysis.opening && (
        <p className="text-sm">
          <span className="text-foreground-500">Abertura </span>
          <span className="font-medium">
            {analysis.opening.name} ({analysis.opening.eco})
          </span>
        </p>
      )}

      <table className="w-full text-sm">
        <caption className="sr-only">Lances por classificação</caption>
        <thead>
          <tr className="text-foreground-500">
            <th className="pb-2 text-left font-normal">Classificação</th>
            <th className="w-16 pb-2 text-right font-normal">Brancas</th>
            <th className="w-16 pb-2 text-right font-normal">Pretas</th>
          </tr>
        </thead>
        <tbody>
          {CLASSIFICATIONS.filter((c) => c !== 'forced' || analysis.white.counts.forced + analysis.black.counts.forced > 0).map((c) => {
            const w = analysis.white.counts[c]
            const b = analysis.black.counts[c]
            return (
              <tr key={c} className={w + b === 0 ? 'text-foreground-400' : ''}>
                <td className="py-1.5">
                  <span className="flex items-center gap-2.5">
                    <ClassBadge classification={c} size={18} />
                    {CLASS_META[c].label}
                  </span>
                </td>
                <td className="py-1.5 text-right font-semibold" style={w ? { color: CLASS_META[c].color } : undefined}>
                  {w}
                </td>
                <td className="py-1.5 text-right font-semibold" style={b ? { color: CLASS_META[c].color } : undefined}>
                  {b}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

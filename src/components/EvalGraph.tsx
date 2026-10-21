import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { GameAnalysis } from '../types'
import { formatScore, winPercentWhite } from '../analysis/winPercent'
import { CLASS_META, NOTABLE } from '../ui/classifications'

interface Props {
  analysis: GameAnalysis
  ply: number
  onSelect: (ply: number) => void
}

export function EvalGraph({ analysis, ply, onSelect }: Props) {
  const data = [
    { ply: 0, win: winPercentWhite(analysis.initialEval), label: 'Início', score: analysis.initialEval, cls: undefined },
    ...analysis.moves.map((m) => ({
      ply: m.ply,
      win: winPercentWhite(m.evalAfter),
      label: `${Math.ceil(m.ply / 2)}${m.color === 'w' ? '.' : '...'} ${m.san}`,
      score: m.evalAfter,
      cls: m.classification,
    })),
  ]

  return (
    <div className="h-24 w-full cursor-pointer overflow-hidden rounded-medium bg-[#3A404B]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          onClick={(e) => {
            const idx = e?.activeTooltipIndex
            if (idx != null) onSelect(Number(idx))
          }}
        >
          <XAxis dataKey="ply" type="number" domain={[0, data.length - 1]} hide />
          <YAxis domain={[0, 100]} hide />
          <ReferenceLine y={50} stroke="#8A9BAE" strokeOpacity={0.5} />
          <ReferenceLine x={ply} stroke="#7C9CBF" strokeWidth={2} />
          <Tooltip
            cursor={{ stroke: '#ECEEF0', strokeOpacity: 0.3 }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as (typeof data)[number] | undefined
              if (!active || !p) return null
              return (
                <div className="rounded-small bg-content1 px-2 py-1 text-xs shadow-md">
                  <span className="font-semibold">{p.label}</span>{' '}
                  <span className="text-foreground-500">{formatScore(p.score)}</span>
                </div>
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="win"
            stroke="#ECEEF0"
            strokeWidth={1}
            fill="#ECEEF0"
            fillOpacity={1}
            baseValue={0}
            isAnimationActive={false}
            dot={(props) => {
              const { cx, cy, payload, index } = props as { cx: number; cy: number; payload: (typeof data)[number]; index: number }
              if (!payload.cls || !NOTABLE.includes(payload.cls)) return <g key={index} />
              return (
                <circle key={index} cx={cx} cy={cy} r={3.5} fill={CLASS_META[payload.cls].color} stroke="#1C2026" strokeWidth={1} />
              )
            }}
            activeDot={{ r: 4, fill: '#7C9CBF', stroke: 'none' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

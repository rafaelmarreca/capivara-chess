import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Popover, PopoverContent, PopoverTrigger, Progress, Slider, Tab, Tabs, Tooltip } from '@heroui/react'
import type { GameAnalysis, ParsedGame } from './types'
import { runAnalysis } from './analysis/runAnalysis'
import { ImportPanel } from './components/ImportPanel'
import { BoardView } from './components/BoardView'
import { EvalBar } from './components/EvalBar'
import { EvalGraph } from './components/EvalGraph'
import { MoveList } from './components/MoveList'
import { MoveDetail } from './components/MoveDetail'
import { Summary } from './components/Summary'
import { IconFirst, IconFlip, IconLast, IconMoon, IconNext, IconPrev, IconSettings, IconSun } from './components/icons'

const DEFAULT_DEPTH = 16

function readDepth() {
  try {
    return Number(localStorage.getItem('depth')) || DEFAULT_DEPTH
  } catch {
    return DEFAULT_DEPTH
  }
}

export default function App() {
  const [game, setGame] = useState<ParsedGame | null>(null)
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ply, setPly] = useState(0)
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const [depth, setDepth] = useState(readDepth)
  const [tab, setTab] = useState<string>('moves')
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const abortRef = useRef<AbortController | null>(null)

  const total = game?.moves.length ?? 0
  const go = useCallback((p: number) => setPly(Math.max(0, Math.min(total, p))), [total])

  useEffect(() => {
    if (!game) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setAnalysis(null)
    setError(null)
    runAnalysis(game, depth, (done, t) => setProgress({ done, total: t }), ctrl.signal)
      .then((a) => {
        if (!ctrl.signal.aborted) setAnalysis(a)
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setError(`A análise falhou: ${e.message}`)
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setProgress(null)
      })
    return () => ctrl.abort()
  }, [game, depth])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!game || (e.target as Element | null)?.closest?.('input, textarea')) return
      const map: Record<string, number> = { ArrowLeft: ply - 1, ArrowRight: ply + 1, Home: 0, End: total }
      if (e.key in map) {
        e.preventDefault()
        go(map[e.key])
      } else if (e.key === 'f') {
        setOrientation((o) => (o === 'white' ? 'black' : 'white'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [game, ply, total, go])

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {
      /* preferência só nesta visita */
    }
  }

  const changeDepth = (d: number) => {
    setDepth(d)
    try {
      localStorage.setItem('depth', String(d))
    } catch {
      /* idem */
    }
  }

  const openGame = (g: ParsedGame) => {
    setGame(g)
    setPly(0)
    setTab('moves')
    setOrientation('white')
  }

  const header = (
    <header className="flex items-center gap-3 border-b border-divider px-4 py-3 sm:px-6">
      <button
        onClick={() => setGame(null)}
        className="flex items-center gap-2 rounded-small font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <img src="/favicon.svg" alt="" width={22} height={22} />
        Revisor
      </button>
      {game && (
        <p className="hidden min-w-0 flex-1 truncate text-sm text-foreground-500 sm:block">
          {game.headers.White ?? 'Brancas'} × {game.headers.Black ?? 'Pretas'}
          {game.headers.Result && game.headers.Result !== '*' ? `, ${game.headers.Result}` : ''}
        </p>
      )}
      <div className="ml-auto flex items-center gap-1">
        {game && (
          <Popover placement="bottom-end">
            <PopoverTrigger>
              <Button isIconOnly variant="light" aria-label="Configurações da análise">
                <IconSettings />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4">
              <Slider
                label="Profundidade do motor"
                minValue={10}
                maxValue={22}
                step={1}
                defaultValue={depth}
                onChangeEnd={(v) => changeDepth(v as number)}
                size="sm"
              />
              <p className="mt-2 text-xs text-foreground-500">Mais profundidade é mais precisa, porém mais lenta.</p>
            </PopoverContent>
          </Popover>
        )}
        <Button isIconOnly variant="light" aria-label={dark ? 'Usar tema claro' : 'Usar tema escuro'} onPress={toggleTheme}>
          {dark ? <IconSun /> : <IconMoon />}
        </Button>
        {game && (
          <Button size="sm" variant="flat" onPress={() => setGame(null)}>
            Nova partida
          </Button>
        )}
      </div>
    </header>
  )

  if (!game) {
    return (
      <>
        {header}
        <ImportPanel onGame={openGame} />
      </>
    )
  }

  const current = analysis?.moves[ply - 1]
  const fen = ply === 0 ? game.startFen : game.moves[ply - 1].fenAfter
  const evalNow = ply === 0 ? analysis?.initialEval : current?.evalAfter
  const h = game.headers
  const top = orientation === 'white' ? 'b' : 'w'
  const playerStrip = (color: 'w' | 'b') => {
    const name = color === 'w' ? (h.White ?? 'Brancas') : (h.Black ?? 'Pretas')
    const elo = color === 'w' ? h.WhiteElo : h.BlackElo
    const lastOwn = [...game.moves.slice(0, ply)].reverse().find((m) => m.color === color)
    const accuracy = analysis?.[color === 'w' ? 'white' : 'black'].accuracy
    return (
      <div className="flex items-center gap-2 py-2 text-sm">
        <span
          className="h-4 w-4 shrink-0 rounded-sm ring-1 ring-foreground/20"
          style={{ background: color === 'w' ? '#ECEEF0' : '#3A404B' }}
        />
        <span className="truncate font-medium">{name}</span>
        {elo && <span className="text-foreground-500">({elo})</span>}
        {accuracy != null && <span className="text-foreground-500">{accuracy.toFixed(1)}%</span>}
        {lastOwn?.clock && (
          <span className="ml-auto rounded-small bg-content2 px-2 py-0.5 font-semibold">{lastOwn.clock}</span>
        )}
      </div>
    )
  }

  const navButton = (label: string, icon: React.ReactNode, onPress: () => void, disabled = false) => (
    <Tooltip content={label} delay={500} closeDelay={0}>
      <Button isIconOnly variant="flat" aria-label={label} onPress={onPress} isDisabled={disabled} className="flex-1">
        {icon}
      </Button>
    </Tooltip>
  )

  return (
    <>
      {header}
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,600px)_minmax(320px,1fr)]">
        <section aria-label="Tabuleiro" className="min-w-0">
          {playerStrip(top)}
          <div className="flex gap-2">
            <EvalBar score={evalNow} orientation={orientation} />
            <div className="min-w-0 flex-1">
              <BoardView fen={fen} move={current} orientation={orientation} />
            </div>
          </div>
          {playerStrip(top === 'w' ? 'b' : 'w')}
          <div className="mt-2 flex gap-2">
            {navButton('Início', <IconFirst />, () => go(0), ply === 0)}
            {navButton('Anterior', <IconPrev />, () => go(ply - 1), ply === 0)}
            {navButton('Próximo', <IconNext />, () => go(ply + 1), ply === total)}
            {navButton('Fim', <IconLast />, () => go(total), ply === total)}
            {navButton('Virar tabuleiro', <IconFlip />, () => setOrientation((o) => (o === 'white' ? 'black' : 'white')))}
          </div>
          {analysis && (
            <div className="mt-4">
              <EvalGraph analysis={analysis} ply={ply} onSelect={go} />
            </div>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-4 lg:max-h-[calc(100vh-7rem)]">
          {progress && (
            <div className="rounded-medium bg-content1 p-4">
              <Progress
                aria-label="Progresso da análise"
                size="sm"
                value={(progress.done / Math.max(1, progress.total)) * 100}
                label={`Analisando posição ${progress.done} de ${progress.total}`}
                showValueLabel
                classNames={{ label: 'text-sm', value: 'text-sm text-foreground-500' }}
              />
            </div>
          )}
          {error && (
            <p role="alert" className="rounded-medium bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex min-h-0 flex-1 flex-col rounded-large bg-content1 p-4">
            <Tabs
              aria-label="Painel da análise"
              selectedKey={tab}
              onSelectionChange={(k) => setTab(String(k))}
              variant="underlined"
              classNames={{ base: '-mx-1', panel: 'flex min-h-0 flex-1 flex-col px-0 pb-0' }}
            >
              <Tab key="moves" title="Lances">
                {analysis && <MoveDetail move={current} initialEval={analysis.initialEval} opening={current?.opening} />}
                <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1 max-lg:max-h-96">
                  <MoveList moves={analysis?.moves ?? game.moves} ply={ply} onSelect={go} />
                </div>
              </Tab>
              <Tab key="summary" title="Resumo" isDisabled={!analysis}>
                {analysis && <Summary game={game} analysis={analysis} />}
              </Tab>
            </Tabs>
          </div>
        </aside>
      </div>
    </>
  )
}

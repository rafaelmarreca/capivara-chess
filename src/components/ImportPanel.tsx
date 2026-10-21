import { useEffect, useRef, useState } from 'react'
import { Button, Textarea } from '@heroui/react'
import type { ParsedGame } from '../types'
import { parsePgnFile } from '../pgn/parse'
import { IconUpload } from './icons'
import { LandingContent } from './LandingContent'

interface Props {
  onGame: (game: ParsedGame) => void
  /** PGN recebido de fora (ex.: arquivo aberto pelo sistema no app instalado). */
  incoming?: { text: string; id: number }
}

function gameTitle(g: ParsedGame) {
  const h = g.headers
  return `${h.White ?? 'Brancas'} × ${h.Black ?? 'Pretas'}`
}

export function ImportPanel({ onGame, incoming }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [choices, setChoices] = useState<ParsedGame[] | null>(null)

  const load = (pgn: string) => {
    setError(null)
    let games: ParsedGame[]
    try {
      games = parsePgnFile(pgn).filter((g) => g.moves.length > 0)
    } catch (e) {
      setError(`Não foi possível ler o PGN: ${(e as Error).message}`)
      return
    }
    if (games.length === 0) setError('Nenhuma partida com lances foi encontrada no arquivo.')
    else if (games.length === 1) onGame(games[0])
    else setChoices(games)
  }

  useEffect(() => {
    if (incoming) load(incoming.text)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage a um novo arquivo recebido
  }, [incoming?.id])

  const loadFile = async (file?: File) => {
    if (file) load(await file.text())
  }

  const loadSample = async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}samples/exemplo.pgn`)
    load(await res.text())
  }

  if (choices) {
    return (
      <section className="mx-auto w-full max-w-xl px-4 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Escolha a partida</h1>
        <p className="mt-2 text-foreground-500">O arquivo tem {choices.length} partidas.</p>
        <ul className="mt-6 divide-y divide-divider overflow-hidden rounded-large bg-content1">
          {choices.map((g, i) => (
            <li key={i}>
              <button
                onClick={() => onGame(g)}
                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left outline-none hover:bg-content2 focus-visible:bg-content2"
              >
                <span className="font-medium">{gameTitle(g)}</span>
                <span className="shrink-0 text-sm text-foreground-500">
                  {[g.headers.Date?.replace(/\./g, '/'), `${Math.ceil(g.moves.length / 2)} lances`].filter(Boolean).join(', ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <Button variant="light" className="mt-4" onPress={() => setChoices(null)}>
          Voltar
        </Button>
      </section>
    )
  }

  return (
    <>
      <section className="mx-auto w-full max-w-xl px-4 py-16 sm:py-24">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Revise sua partida do Lichess</h1>
        <p className="mt-3 max-w-prose text-foreground-500">
          Importe o PGN exportado do Lichess. Cada lance recebe uma classificação, do brilhante à capivarada. A análise
          roda no seu navegador com o Stockfish.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            loadFile(e.dataTransfer.files[0])
          }}
          className={`mt-8 flex flex-col items-center gap-4 rounded-large border-2 border-dashed px-6 py-12 text-center transition-colors ${
            dragging ? 'border-primary bg-primary/10' : 'border-default-300 bg-content1'
          }`}
        >
          <MiniBoard />
          <p className="text-foreground-500">Arraste o arquivo .pgn para cá</p>
          <Button color="primary" startContent={<IconUpload />} onPress={() => fileRef.current?.click()}>
            Escolher arquivo
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".pgn,.txt,application/x-chess-pgn"
            className="hidden"
            onChange={(e) => loadFile(e.target.files?.[0])}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="flat" onPress={() => setPasting((v) => !v)}>
            {pasting ? 'Fechar' : 'Colar PGN'}
          </Button>
          <Button variant="light" onPress={loadSample}>
            Abrir partida de exemplo
          </Button>
        </div>

        {pasting && (
          <div className="mt-4 flex flex-col gap-3">
            <Textarea
              aria-label="Texto PGN"
              placeholder={'[Event "Rated Blitz game"]\n…\n1. e4 e5 2. Nf3 …'}
              minRows={6}
              value={text}
              onValueChange={setText}
              classNames={{ input: 'font-mono text-xs' }}
            />
            <Button color="primary" className="self-start" isDisabled={!text.trim()} onPress={() => load(text)}>
              Analisar partida
            </Button>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-medium bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </section>
      <LandingContent />
    </>
  )
}

/** Pequeno tabuleiro 4×4 decorativo para a área de importação. */
function MiniBoard() {
  return (
    <svg width="56" height="56" viewBox="0 0 4 4" aria-hidden className="rounded-small">
      {Array.from({ length: 16 }, (_, i) => (
        <rect key={i} x={i % 4} y={Math.floor(i / 4)} width="1" height="1" fill={(i + Math.floor(i / 4)) % 2 ? '#8A9BAE' : '#DCE1E6'} />
      ))}
    </svg>
  )
}

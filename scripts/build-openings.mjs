// Gera src/data/openings.json a partir dos TSVs de lichess-org/chess-openings.
// Uso: node scripts/build-openings.mjs <pasta-com-a..e.tsv>
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Chess } from 'chess.js'

const dir = process.argv[2]
if (!dir) throw new Error('Informe a pasta com os arquivos a.tsv..e.tsv')

const epd = (fen) => fen.split(' ').slice(0, 4).join(' ')
const named = {}
const book = new Set()

for (const f of ['a', 'b', 'c', 'd', 'e']) {
  const lines = readFileSync(join(dir, `${f}.tsv`), 'utf8').trim().split('\n').slice(1)
  for (const line of lines) {
    const [eco, name, pgn] = line.split('\t')
    const chess = new Chess()
    const sans = pgn.replace(/\d+\.(\.\.)?/g, ' ').trim().split(/\s+/)
    for (const san of sans) {
      chess.move(san)
      book.add(epd(chess.fen()))
    }
    const key = epd(chess.fen())
    // Mantém o nome mais curto (mais genérico) quando vários levam à mesma posição
    if (!named[key] || named[key][1].length > name.length) named[key] = [eco, name]
  }
}

writeFileSync(
  new URL('../src/data/openings.json', import.meta.url),
  JSON.stringify({ named, book: [...book] }),
)
console.log(`${Object.keys(named).length} aberturas nomeadas, ${book.size} posições de livro`)

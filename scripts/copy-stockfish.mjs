// Copia o Stockfish (lite, single-thread) para public/ para ser servido como Web Worker.
import { copyFileSync, mkdirSync } from 'node:fs'

const src = new URL('../node_modules/stockfish/bin/', import.meta.url)
const dest = new URL('../public/stockfish/', import.meta.url)
mkdirSync(dest, { recursive: true })
for (const f of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) {
  copyFileSync(new URL(f, src), new URL(f, dest))
}

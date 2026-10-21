// Gera public/og-image.png (1200×630), a imagem de prévia de links (Open Graph / Twitter).
// Uso: npm run og-image
// O texto é renderizado com as fontes do sistema (librsvg); o PNG gerado fica versionado em public/.
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

const out = fileURLToPath(new URL('../public/og-image.png', import.meta.url))

const W = 1200
const H = 630
const font = "'Instrument Sans', 'Noto Sans', 'DejaVu Sans', sans-serif"

// Algumas classificações como pequenos acentos (cores de src/ui/classifications.ts)
const badges = [
  { glyph: '!!', color: '#26B5AE' },
  { glyph: '!', color: '#5B8FC7' },
  { glyph: '★', color: '#7FB24A' },
  { glyph: '?!', color: '#E8B537' },
  { glyph: '?', color: '#E2832B' },
  { glyph: '??', color: '#CF3A34' },
]

const textX = 450
const badgeY = 478
const badgeR = 20

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#1C2026"/>

  <!-- logo (public/favicon.svg) ampliado -->
  <g transform="translate(110 175) scale(4.375)">
    <rect width="64" height="64" rx="14" fill="#2D333D"/>
    <path d="M9 46 C9 32 17 21 31 20.5 L46 20.5 C52.5 20.5 56.5 23.5 56.5 30 L56.5 34 C56.5 39.5 52.5 42.5 46 43 L39.5 43.5 C35.5 48.5 29 51 21 51 C14 51 9 49.5 9 46 Z" fill="#A68A6D"/>
    <ellipse cx="22.5" cy="21.5" rx="4.2" ry="3.6" fill="#8C7158"/>
    <circle cx="37" cy="28.5" r="2.1" fill="#1C2026"/>
    <ellipse cx="52.6" cy="29.6" rx="1.3" ry="1.9" fill="#5E4B3B"/>
    <path d="M47 38.5 C49.5 38.8 51.8 38 53.4 36.6" stroke="#5E4B3B" stroke-width="1.4" fill="none" stroke-linecap="round"/>
  </g>

  <text x="${textX}" y="282" font-family="${font}" font-size="88" font-weight="700" fill="#E6E8EB" letter-spacing="-2">Capivara Chess</text>
  <text x="${textX}" y="350" font-family="${font}" font-size="38" fill="#B4BAC3">Revise suas partidas de xadrez</text>
  <text x="${textX}" y="400" font-family="${font}" font-size="38" fill="#B4BAC3">do Lichess, lance a lance.</text>

  ${badges
    .map((b, i) => {
      const cx = textX + badgeR + i * (badgeR * 2 + 12)
      const size = b.glyph.length > 1 ? 18 : 22
      return `<circle cx="${cx}" cy="${badgeY}" r="${badgeR}" fill="${b.color}"/>
  <text x="${cx}" y="${badgeY + size * 0.36}" text-anchor="middle" font-family="${font}" font-size="${size}" font-weight="700" fill="#FFFFFF">${b.glyph}</text>`
    })
    .join('\n  ')}
  <text x="${textX + 6 * (badgeR * 2 + 12) + 8}" y="${badgeY + 10}" font-family="${font}" font-size="28" font-weight="600" fill="#7C9CBF">Grátis, sem cadastro</text>
</svg>`

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out)
console.log(`og-image gerada em ${out}`)

# Capivara

Analisador de partidas de xadrez grátis e open source para o Lichess no estilo da "Revisão de partida" do chess.com. Importe um PGN e cada lance recebe uma classificação (Brilhante, Ótimo, Melhor, Excelente, Bom, Livro, Imprecisão, Erro, Lance perdido, Capivarada), com barra de avaliação, gráfico, precisão por jogador e melhor lance sugerido. Tudo roda no navegador com Stockfish 19 (WASM lite, single-thread).

```bash
npm install   # também copia o Stockfish para public/stockfish
npm run dev
npm test
```

- Regras e limiares de classificação: `src/analysis/classify.ts`
- Precisão (método lichess): `src/analysis/accuracy.ts`
- Livro de aberturas: `src/data/openings.json`, gerado de [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) com `node scripts/build-openings.mjs <pasta-com-a..e.tsv>`
- As avaliações ficam em cache no `localStorage` por partida e profundidade.

## Deploy e SEO

```bash
# build com a URL pública final (canonical, og:url, og:image absolutas e sitemap.xml)
SITE_URL=https://exemplo.com/capivara-chess/ BASE_PATH=/capivara-chess/ npm run build
```

- `BASE_PATH`: caminho onde o app é servido (ex.: `/capivara-chess/` no GitHub Pages). Padrão `/`.
- `SITE_URL`: URL pública completa do app, incluindo o caminho. Opcional: sem ela o build omite `canonical`, `og:url` e `sitemap.xml`, e a imagem do Open Graph usa caminho relativo (prévias de link em redes sociais exigem URL absoluta, então defina no deploy real). Se só a origem for informada, o `BASE_PATH` é acrescentado.
- O build gera `robots.txt` (com a linha `Sitemap:` quando há `SITE_URL`) e pré-renderiza a página inicial no `index.html` (plugin `seo` em `vite.config.ts`, a partir de `src/prerender.tsx`), para que buscadores e quem está sem JS vejam o conteúdo. No navegador, `createRoot` substitui esse HTML pela mesma marcação interativa.
- Textos de SEO (título, descrição, passos, classificações e FAQ, usado também no JSON-LD): `src/seo/content.ts`.
- Imagem de prévia (1200×630): `npm run og-image` regera `public/og-image.png` a partir de `scripts/build-og-image.mjs`.
- Buscadores só leem `robots.txt` na raiz do domínio. Num subcaminho do GitHub Pages ele é ignorado; envie o sitemap pelo Google Search Console.

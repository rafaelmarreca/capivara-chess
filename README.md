# Capivara Chess

Analisador de partidas de xadrez grátis e open source para o Lichess no estilo da "Revisão de partida" do chess.com. Importe um PGN e cada lance recebe uma classificação (Brilhante, Ótimo, Melhor, Excelente, Bom, Livro, Imprecisão, Erro, Lance perdido, Capivarada), com barra de avaliação, gráfico, precisão por jogador e melhor lance sugerido. Tudo roda no navegador com Stockfish 19 (WASM lite, single-thread).

- **Comentário de cada lance** com peças e casas reais ("você deixou o cavalo em c3 sem defesa", "abre a diagonal do bispo de c8"), setas no tabuleiro e o porquê do melhor lance. As frases saem da linha da engine e do `chess.js`, sem modelo de linguagem: só se afirma o que a linha confirma.
- **Análises salvas** automaticamente, com nota por lance e comentário da partida, em "Minhas análises".
- **"Sou eu"**: o jogador marca o próprio usuário; o tabuleiro abre do lado dele e "você" nas frases é ele.
- **Login opcional com Google** para sincronizar análises, notas e nomes entre aparelhos (Firebase).
- **Celular em retrato numa tela só**: faixa horizontal de lances, cabeçalho que aparece ao puxar para baixo.

```bash
npm install   # também copia o Stockfish para public/stockfish
npm run dev
npm test
```

- Regras e limiares de classificação: `src/analysis/classify.ts`
- Precisão (método lichess): `src/analysis/accuracy.ts`
- Livro de aberturas: `src/data/openings.json`, gerado de [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) com `node scripts/build-openings.mjs <pasta-com-a..e.tsv>`
- Comentários dos lances: `src/analysis/explain.ts` (táticos: peça entregue, captura perdida, mate, garfo), `src/analysis/positional.ts` (roque, desenvolvimento, centro, coluna aberta, peão passado), `src/analysis/bestReason.ts` (por que o melhor lance era melhor) e as frases em `src/ui/explainText.ts`. Os testes em `src/__tests__/explain.test.ts` e `bestReason.test.ts` usam posições reais, inclusive casos em que a frase **não** deve aparecer.
- Biblioteca de análises: `src/library/`. Sem login, IndexedDB; com login, Firestore (`users/{uid}/games`, `evals` e `profile`). Só as avaliações cruas são salvas; a análise é remontada ao abrir.

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

## Login e sincronização (Firebase)

Opcional: sem a config em `src/library/firebaseConfig.ts` o botão de login não aparece e tudo fica no aparelho. O passo a passo está em [`docs/firebase-setup.md`](docs/firebase-setup.md).

- As regras do Firestore (`firestore.rules`) são publicadas à mão (console ou `firebase deploy --only firestore:rules`), nunca no CI. Republique sempre que o arquivo mudar.
- No site publicado o login é por redirect, passando pelo próprio domínio: o helper do Firebase Auth (`/__/auth/*`) é servido pelo repositório [`rafaelmarreca/rafaelmarreca.github.io`](https://github.com/rafaelmarreca/rafaelmarreca.github.io), cópia de `capivara-chess.firebaseapp.com/__/auth/` que precisa ser atualizada de tempos em tempos (comandos no README dele). No `localhost` o login é por popup.
- O SDK do Firebase só é baixado por quem entra com Google (import dinâmico, fora do precache do service worker).

## Licença

[GPL-3.0](LICENSE). O Stockfish, distribuído junto com o site, também é GPL-3.0.

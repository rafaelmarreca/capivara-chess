# Revisor de partidas

Analisador de partidas do Lichess no estilo da "Revisão de partida" do chess.com. Importe um PGN e cada lance recebe uma classificação (Brilhante, Ótimo, Melhor, Excelente, Bom, Livro, Imprecisão, Erro, Lance perdido, Capivarada), com barra de avaliação, gráfico, precisão por jogador e melhor lance sugerido. Tudo roda no navegador com Stockfish 19 (WASM lite, single-thread).

```bash
npm install   # também copia o Stockfish para public/stockfish
npm run dev
npm test
```

- Regras e limiares de classificação: `src/analysis/classify.ts`
- Precisão (método lichess): `src/analysis/accuracy.ts`
- Livro de aberturas: `src/data/openings.json`, gerado de [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) com `node scripts/build-openings.mjs <pasta-com-a..e.tsv>`
- As avaliações ficam em cache no `localStorage` por partida e profundidade.

# Revisão no celular numa tela só + comentário concreto de cada lance

## Intenção

Duas melhorias na tela de revisão, inspiradas na revisão de partida do chess.com:

1. **No celular, tudo numa tela, sem rolar a página.** Hoje o tabuleiro, o gráfico, a lista
   de lances e o card do lance ficam empilhados, e o usuário precisa rolar para ver tudo.
   (O bug da página rolando sozinha ao avançar o lance já foi corrigido no commit 31d7201.)
2. **Um comentário que explica o porquê da classificação, sobre o lance real.** Hoje o card
   diz só "Dxb7 é uma capivarada" e "Melhor era Td1". O usuário quer frases como "você
   entregou o cavalo de graça" ou "você perdeu a chance de capturar a dama", sobre as peças
   e casas daquele lance, e não uma frase genérica.

## Metas

- No celular (largura < 1024 px, o breakpoint `lg` atual, **em retrato**), a revisão cabe na
  área visível (`100dvh`; ~660 px num iPhone com as barras do Safari) sem rolar a página:
  tabuleiro, faixa de lances, comentário, nota e botões de navegação. *Minha decisão:* o alvo
  é a área visível, não a altura da tela; se faltar espaço, o card do comentário rola por
  dentro.
- *Minha decisão:* em paisagem (altura < largura) e abaixo de `lg`, mantém o layout
  empilhado atual com rolagem de página. Numa altura de ~375 px não cabe nada útil.
- A lista de lances vira uma **faixa horizontal rolável** no celular.
- Cada lance analisado ganha um **comentário gerado a partir dos fatos da engine e das
  regras do xadrez**, citando peças, casas e lances reais.

## Fora de escopo

- Gerar texto com modelo de linguagem (no navegador ou por API). O usuário decidiu: as
  frases a partir da engine bastam. Um modelo pode reescrever essas frases no futuro.
- Mudar o layout do desktop, além de mostrar o comentário novo no card do lance.
- Mudar a classificação dos lances.

## Anti-metas

- **Comentário que afirma algo falso** (peça "entregue" que não estava pendurada, mate que
  não existe). Melhor não dizer nada concreto do que inventar. Toda frase concreta precisa
  ser verificável pela linha da engine ou pela posição.
- No celular, o tabuleiro mudar de lugar ou a página rolar ao navegar entre lances.
- Esconder a barra de avaliação vertical.

## Decisões tomadas com o usuário

### Layout do celular: opção B do mockup (`docs/mockups/revisao-celular.html`)

De cima para baixo:

1. Cabeçalho atual.
2. Faixa do jogador de cima (nome, precisão, relógio), como hoje.
3. **Tabuleiro com a barra de avaliação vertical ao lado**, como hoje. O usuário pediu
   explicitamente para manter a barra lateral de brancas e pretas.
4. Faixa do jogador de baixo.
5. **Faixa horizontal de lances**, rolável, com números ("16.") e lances; o lance atual em
   destaque, com a cor da classificação. Ao navegar, a faixa rola sozinha para manter o
   lance atual visível, sem rolar a página. Tocar num lance navega até ele.
6. **Card do comentário:** badge + frase da classificação ("18. Dxb7 é uma capivarada"),
   a explicação concreta e o "Melhor era X". As chips da linha sugerida continuam onde
   couberem.
7. **Nota:** um "✎ Sua nota…" compacto que se expande ao tocar.
8. **Botões de navegação** (início, anterior, próximo, fim, virar) no rodapé.

Seta verde do melhor lance e badge na casa de destino continuam como estão (`BoardView`).

### Quem é "você" nas frases

O app não sabe com qual cor o usuário jogou. **"Você" é o lado que está embaixo no
tabuleiro** (`orientation`): lances desse lado em segunda pessoa ("Você deixou o cavalo em c3
sem defesa"), lances do outro lado em terceira ("As pretas deixaram…"). Virar o tabuleiro
troca quem é "você". *Minha decisão:* ao abrir uma partida o tabuleiro continua começando
pelas brancas, como hoje; guardar a orientação por partida fica para depois.

### Comentários: fatos da engine, não modelo

Usar a linha da engine (`PositionEval.lines`, MultiPV 2, PV até 10 lances) e o `chess.js`
para detectar o que aconteceu e montar frases com peças, casas e lances reais.

## Desenho sugerido (decisões minhas; o construtor pode ajustar)

### Onde ficam Resumo e gráfico no celular

Saem do fluxo, para não empurrar o tabuleiro. Um botão "Resumo" (com o gráfico de avaliação
dentro) abre um painel por cima (drawer/modal do HeroUI). O comentário geral da partida fica
nesse painel, como já está na aba Resumo. *Minha decisão, mostrada no mockup e não contestada.*

### Durante a análise e sem análise

*Minha decisão:* o layout mantém os mesmos espaços, para o tabuleiro não mudar de lugar. O
card do comentário mostra a barra de progresso ("Analisando posição 12 de 66") ou o erro, e a
faixa de lances já aparece, sem classificações, enquanto a análise roda.

### Altura

O tabuleiro é o elemento que se ajusta: largura total, mas limitada para que o resto caiba
(ex.: `min(100vw - barra, 100dvh - altura do resto)`). Em telas muito baixas, o comentário
pode rolar dentro do próprio card, nunca a página.

### Detector de motivos (`src/analysis/explain.ts`, puro e testável)

Entrada: o `AnalyzedMove`, o `PositionEval` antes e depois do lance e a cor de quem jogou.
Saída: uma lista ordenada de **motivos**, cada um com dados estruturados (peça, casa, lance,
quantidade de material, número de lances até o mate); o texto é montado à parte. Motivos
iniciais, por prioridade:

| Motivo | Como detectar | Frase (exemplo) |
|---|---|---|
| Mate permitido | `evalAfter` é mate para o adversário | "Depois disso, as pretas dão mate em 2 com **Dxf2+**." |
| Mate perdido | a melhor linha antes era mate a favor e o lance jogado não mantém mate | "Você tinha mate em 3 começando com **Txe8+**." |
| Peça entregue | na melhor resposta do adversário (PV depois do lance), simulando ~4 plies, o jogador perde ≥ 2 pontos de material, e a primeira captura é de uma peça que estava indefesa ou mal defendida | "Você deixou o **cavalo em c3** sem defesa: depois de **Bxc3** você fica uma peça atrás." |
| Captura perdida | o melhor lance antes era uma captura que, pela PV, ganha ≥ 2 pontos líquidos, e o lance jogado não ganha isso | "Você perdeu a chance de capturar a **dama em d5** com **Cxd5**." |
| Garfo permitido / perdido | o lance relevante (resposta do adversário ou melhor lance) ataca 2+ peças de valor ≥ o dele (ou rei + peça) e a PV confirma o ganho de material | "**Cc7+** dá garfo no rei e na torre." |
| Lance bom com ganho | brilhante, ótimo ou melhor que ganha material ou força mate pela PV | "**Bxf7+** ganha o peão e o rei fica exposto." |

*Minha decisão:* "única defesa contra o mate" fica **fora** desta versão. Exigiria provar com a
2ª linha (MultiPV 2) que os outros lances levam a mate, e o risco de frase falsa é alto.

Valores de material: os de `sacrifice.ts` (p1, n3, b3, r5, q9). Nomes das peças em
português ("cavalo", "bispo", "torre", "dama", "peão", "rei"); lances em SAN figurada,
como no resto do app.

**Regra de segurança:** um motivo só entra se a PV da engine confirmar o ganho/perda
material ou o mate. Sem confirmação, não há frase concreta.

**Fallback:** sem motivo detectado, o card mostra só a frase atual da classificação e o
"Melhor era X", como hoje.

### Onde aparece

- Celular: no card do comentário (item 6 do layout).
- Desktop: no `MoveDetail` atual, logo abaixo da frase da classificação.

### Cálculo

Na hora de montar a análise (`buildAnalysis`) ou sob demanda ao exibir o lance, a partir
dos `evals` salvos. Assim funciona também para análises já salvas, sem reanalisar.

## O que fica para o construtor

- Componentes exatos do HeroUI para o drawer do Resumo e para a nota expansível.
- Profundidade da simulação da PV (sugestão: até 4 plies, ou até a sequência de capturas
  acabar).
- Redação final das frases, mantendo o tom do app ("capivarada" etc.).
- Testes: cada motivo com uma posição FEN real e a PV correspondente; posições em que o
  motivo **não** deve disparar (peça atacada mas defendida, troca equilibrada).

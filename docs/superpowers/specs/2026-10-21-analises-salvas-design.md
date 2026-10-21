# Análises salvas e sincronização com conta Google

## Intenção

Hoje o Capivara analisa uma partida e, ao sair dela, não tem como voltar: só existe
um cache silencioso de avaliações no localStorage. O usuário quer reabrir depois
**a partida com a análise da engine e os próprios comentários**, principalmente
**uma nota por lance**, e também um comentário geral da partida.

Quem quiser pode entrar com Google para **abrir as mesmas análises no celular e no
computador sem perder nada**. Sem login, o app continua completo, guardando tudo
só no aparelho.

## Metas

1. Toda partida analisada é salva automaticamente. Não existe botão "Salvar".
2. Lista "Minhas análises" na tela inicial; abrir um item restaura partida,
   análise e notas **sem rodar a engine de novo**.
3. Nota por lance e comentário geral da partida, com salvamento automático.
4. Login opcional com Google; logado, as análises sincronizam entre aparelhos.
5. Funciona offline (é um PWA), inclusive logado.

## Fora de escopo

- Compartilhar análises com outras pessoas, links públicos.
- Outros provedores de login (e-mail/senha, Lichess etc.). Só Google.
- Guardar várias análises da mesma partida lado a lado.
- Exportar PGN com as notas (bom candidato para depois, não agora).
- Servidor próprio ou qualquer custo mensal.

## Anti-metas (falharia mesmo "funcionando")

- Perder uma nota que o usuário escreveu (sobrescrita silenciosa, sync que apaga).
- Exigir login para usar qualquer coisa que hoje funciona sem login.
- Deixar análises de uma conta visíveis no aparelho depois do logout.
- Quebrar o pré-render (SSR do build) ou deixar o carregamento inicial pesado por
  causa do SDK de login para quem nunca vai logar.

## Restrições

- Site estático no GitHub Pages (`rafaelmarreca.github.io/capivara-chess`), PWA,
  com pré-render via `src/prerender.tsx`. Nada de backend próprio.
- Serviço com plano gratuito sem cartão e **sem pausa por inatividade**.
- Seguir a UI existente: HeroUI, visual sóbrio (ver preferência de design do projeto).
- Texto da interface em português, como o resto do app.

## Decisões tomadas com o usuário

### Serviço: Firebase (Auth + Cloud Firestore), plano Spark

Comparado com Supabase (pausa o projeto após 7 dias sem uso), Appwrite (mesma
pausa) e Google Drive `appDataFolder` (sem backend, mas toda a sincronização e os
conflitos seriam feitos à mão). O Firestore já tem cache offline persistente e
sincronização embutidos.

Limites do Spark conferidos na página oficial (out/2026): 1 GiB armazenado,
50 mil leituras, 20 mil gravações e 20 mil exclusões por dia, 10 GiB/mês de
saída; Auth com 50 mil usuários ativos/mês. Uma partida salva tem da ordem de
30 KB (MultiPV 2, PV cortada em 10 lances, como já é feito em
`runAnalysis.ts`).

### Login: só Google

Botão "Entrar com Google" no cabeçalho, opcional. Logado, mostra o avatar com
menu "Sair".

### Nota por lance: escreve no card, lê na lista (opção C do mockup)

- No card do lance (`MoveDetail`), abaixo da explicação da engine, um campo
  "Sua nota" que salva sozinho enquanto o usuário digita.
- Na lista de lances (`MoveList`), a nota aparece resumida logo abaixo do lance,
  no estilo de livro de xadrez; clicar nela navega até o lance.
- A posição inicial (antes do 1º lance) não tem nota de lance.

### Comentário geral

Campo na aba Resumo, com o mesmo comportamento de salvamento automático.
*(Posição sugerida por mim e não contestada pelo usuário.)*

### Lista na tela inicial (opção A do mockup)

Abaixo do painel de importação, "Minhas análises", da mais recente para a mais
antiga: jogadores, resultado, data e quantas notas tem. Clicar abre a partida
analisada.

### Uma entrada por partida

Importar de novo a mesma partida, ou reanalisar com outra profundidade, mantém
**um único item**: as notas são preservadas e a análise nova substitui a antiga.

*Minhas decisões, coerentes com isso:*
- Abrir uma partida salva usa a análise guardada, **mesmo que a profundidade
  configurada hoje seja outra**. Não roda a engine.
- Mudar a profundidade com a partida aberta reanalisa (como hoje) e, ao terminar,
  substitui a análise salva, seja mais ou menos profunda.
- Só análises **completas** são salvas. Cancelar ou sair no meio não grava nada
  (se a partida já estava salva, a análise anterior fica). O campo de nota só
  aparece quando há análise do lance, como o card hoje.

### Logout limpa o aparelho

Se o usuário estava logado e sai, todas as análises dessa conta são apagadas do
aparelho (inclusive o cache offline do Firestore). Elas continuam na conta.

*Minha decisão:* antes de limpar, o logout descarrega o debounce pendente e espera
`waitForPendingWrites`. Se estiver offline (ou demorar), mostra um aviso
"Há notas ainda não sincronizadas; sair agora vai perdê-las" com "Cancelar" e
"Sair mesmo assim". Nunca apaga sem avisar.

### Infra do Firebase: manual, feita pelo usuário

Ainda não existe projeto. O plano começa com um passo a passo para o usuário:
criar o projeto no console, ativar o provedor Google no Auth, adicionar
`rafaelmarreca.github.io` (e `localhost`) aos domínios autorizados e criar o
banco Firestore. O repositório traz a config pública do app web commitada (não é
segredo), mais `firebase.json` e `firestore.rules`. **As regras são publicadas à
mão** pelo usuário com `firebase deploy --only firestore:rules`; nada de deploy
do Firebase no CI.

## Desenho sugerido (decisões minhas, o construtor pode ajustar)

### Identidade da partida

`id = hash(startFen + sequência de lances em UCI)`. Os cabeçalhos do PGN ficam
de fora, para que a mesma partida vinda do Lichess e de um PGN colado à mão seja
a mesma entrada. Use um hash com baixa chance de colisão (por exemplo SHA-256
via `crypto.subtle`, cortado), não o djb2 de 32 bits do cache atual.

### O que é salvo

- `pgn` original, `headers` (para a lista), `createdAt`, `updatedAt`.
- `depth` e `evals: PositionEval[]` (o mesmo que o cache atual guarda). A
  `GameAnalysis` é reconstruída com `buildAnalysis` ao abrir: fica menor e
  acompanha melhorias futuras na classificação.
- `notes: Record<ply, { text, updatedAt }>` e `comment: { text, updatedAt }`.

Separar metadados+notas de `evals` (dois documentos, ou um store e um
documento separados) evita baixar todas as avaliações só para montar a lista.

### Armazenamento

- **Sem login:** IndexedDB (localStorage tem ~5 MB e enche com dezenas de
  partidas). Um wrapper pequeno, tipo `idb-keyval`, basta.
- **Logado:** Firestore em `users/{uid}/games/{id}` (metadados + notas) e
  `users/{uid}/evals/{id}`, com `persistentLocalCache` para funcionar offline.
  Regras de segurança: cada usuário só lê e grava sob o próprio `uid`.
- Uma interface única de repositório (`listGames`, `getGame`, `saveAnalysis`,
  `saveNote`, `saveComment`, `deleteGame`) com as duas implementações; a UI não
  sabe qual está ativa.
- O cache atual `capivara:v1:*` no localStorage é absorvido: pode ser lido como
  fallback ou simplesmente descartado.

### Entrar com conteúdo local

Ao logar, as análises guardadas sem conta sobem para a conta. Se a mesma
partida já existir lá, mescla: para cada nota (e para o comentário geral) vence
o `updatedAt` mais recente; a análise feita mais recentemente vence (mesma regra
de "a nova substitui a antiga"). Depois da
subida, o armazenamento local sem conta é limpo.

### Conflitos entre aparelhos

Gravar notas campo a campo (`notes.<ply>`), não o documento inteiro, para que
editar o lance 12 no celular e o lance 30 no computador não se sobrescrevam.
Na mesma nota, a última gravação vence. Salvamento com debounce (~1 s) para não
gastar a cota de gravações.

### Excluir

Menu em cada item da lista com "Excluir", com confirmação.

*Minha decisão:* exclusão definitiva, sem "lixeira". Gravações de nota usam
`update` (nunca `set` com merge), então uma nota editada offline num aparelho
não ressuscita uma partida apagada em outro: a gravação falha e é descartada.

### Carregamento

O SDK do Firebase é carregado sob demanda (import dinâmico) só no cliente,
quando o usuário clica em "Entrar" ou quando já existe sessão salva. Nada de
Firebase no pré-render. A config do Firebase é pública por natureza; a proteção
está nas regras do Firestore. O domínio do GitHub Pages precisa estar nos
domínios autorizados do Firebase Auth.

## O que fica para o construtor

- Biblioteca de IndexedDB, formato exato dos documentos, nomes de arquivos.
- Login com popup ou redirect (popup costuma falhar em PWA instalado no iOS;
  avaliar e ter fallback).
- Visual fino dos componentes novos dentro do padrão HeroUI do app.
- Estado vazio da lista, e quantos itens mostrar antes de paginar/rolar.
- Testes: pelo menos identidade da partida, mescla de notas no login e o
  repositório local.

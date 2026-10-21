/**
 * Textos da página inicial usados tanto na interface (LandingContent) quanto nos
 * metadados gerados no build (JSON-LD em vite.config.ts). Manter em texto puro,
 * sem JSX, para que o FAQ estruturado seja idêntico ao FAQ visível.
 */
import type { Classification } from '../types'

export const SITE_NAME = 'Capivara Chess'

export const SEO_TITLE = 'Capivara Chess — análise grátis de partidas de xadrez do Lichess'

/** Meta description (~150 caracteres). */
export const SEO_DESCRIPTION =
  'Analise suas partidas do Lichess de graça: cada lance classificado, do brilhante à capivarada, com o Stockfish 19 rodando no navegador. Sem cadastro.'

/** Descrição longa (manifesto do PWA e JSON-LD). */
export const LONG_DESCRIPTION =
  'Analisador de partidas de xadrez grátis e open source. Importe o PGN do Lichess e veja cada lance classificado, do brilhante à capivarada, com o Stockfish rodando no seu navegador.'

export const OG_IMAGE_ALT =
  'Logo do Capivara Chess, uma capivara de perfil, ao lado do texto: revise suas partidas de xadrez do Lichess, lance a lance.'

export const FEATURES = [
  'Importação de PGN do Lichess por arquivo, arrastar e soltar ou texto colado',
  'Stockfish 19 (WebAssembly) rodando no navegador',
  'Classificação de cada lance, de brilhante a capivarada',
  'Barra e gráfico de avaliação',
  'Precisão de cada jogador pela fórmula do Lichess',
  'Sugestão do melhor lance em cada posição',
  'Detecção da abertura',
  'Análises salvas automaticamente, com notas por lance e comentário da partida',
  'Login opcional com Google para sincronizar as análises entre aparelhos',
  'Funciona offline e pode ser instalado como app',
]

export const STEPS: { title: string; text: string }[] = [
  {
    title: 'Exporte o PGN',
    text: 'No Lichess, abra a partida, toque em compartilhar e baixe o PGN. Arquivos de outros sites também servem.',
  },
  {
    title: 'Importe aqui',
    text: 'Arraste o arquivo para a área acima, escolha o arquivo ou cole o texto do PGN.',
  },
  {
    title: 'Revise os lances',
    text: 'O Stockfish avalia cada posição e mostra onde você acertou, onde errou e qual era o melhor lance.',
  },
]

/** O que cada classificação significa, na ordem em que aparecem na revisão. */
export const CLASS_DESCRIPTIONS: { key: Classification; text: string }[] = [
  { key: 'brilliant', text: 'Um sacrifício de material que funciona e é difícil de enxergar.' },
  { key: 'great', text: 'O único lance que mantém a vantagem ou salva a posição.' },
  { key: 'best', text: 'O lance que o Stockfish escolheria.' },
  { key: 'excellent', text: 'Quase tão bom quanto o melhor lance.' },
  { key: 'good', text: 'Um lance sólido que perde pouco.' },
  { key: 'book', text: 'Teoria de abertura conhecida.' },
  { key: 'forced', text: 'Era o único lance legal na posição.' },
  { key: 'inaccuracy', text: 'Perde um pouco da avaliação. Havia algo melhor.' },
  { key: 'mistake', text: 'Piora bastante a posição.' },
  { key: 'miss', text: 'O adversário errou e você não aproveitou a chance.' },
  { key: 'blunder', text: 'O erro grave que entrega a partida. A gíria que dá nome ao app.' },
]

export const FAQ: { q: string; a: string }[] = [
  {
    q: 'É grátis?',
    a: 'Sim. O Capivara Chess é gratuito e open source, sem limite de partidas e sem anúncios.',
  },
  {
    q: 'Precisa de conta?',
    a: 'Não. Basta importar o PGN da partida, sem cadastro. O login com Google é opcional e serve só para sincronizar suas análises entre aparelhos.',
  },
  {
    q: 'Minhas análises ficam salvas?',
    a: 'Sim. Toda partida analisada é salva automaticamente, junto com suas notas em cada lance e o comentário da partida, e aparece em "Minhas análises" na página inicial. Sem login, ficam só neste navegador. Com login, ficam na sua conta e abrem no celular e no computador.',
  },
  {
    q: 'Funciona com partidas do chess.com?',
    a: 'Sim. Qualquer PGN padrão funciona, seja do Lichess, do chess.com ou de outro site ou programa de xadrez.',
  },
  {
    q: 'Meus dados saem do computador?',
    a: 'Sem login, não: o Stockfish roda dentro do seu navegador e nada é enviado para um servidor. Se você entrar com Google, as análises e notas salvas são guardadas na sua conta, no Firebase, e só você tem acesso a elas.',
  },
  {
    q: 'Funciona offline?',
    a: 'Sim. Depois do primeiro acesso, o Capivara Chess funciona sem internet e pode ser instalado como app no computador ou no celular. Com login, as notas feitas offline sincronizam quando a conexão volta.',
  },
]

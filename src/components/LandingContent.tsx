import { CLASS_META } from '../ui/classifications'
import { CLASS_DESCRIPTIONS, FAQ, STEPS } from '../seo/content'
import { ClassBadge } from './ClassBadge'

/** Conteúdo explicativo da página inicial (também pré-renderizado no build para buscadores). */
export function LandingContent() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-14 px-4 pb-20">
      <section aria-labelledby="como-funciona">
        <h2 id="como-funciona" className="text-xl font-semibold tracking-tight">
          Como funciona
        </h2>
        <ol className="mt-4 flex flex-col gap-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-content2 text-sm font-semibold"
              >
                {i + 1}
              </span>
              <div>
                <h3 className="font-medium">{s.title}</h3>
                <p className="mt-0.5 text-foreground-500">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="classificacoes">
        <h2 id="classificacoes" className="text-xl font-semibold tracking-tight">
          O que significa cada classificação
        </h2>
        <p className="mt-2 text-foreground-500">
          A revisão segue a ideia da revisão de partida do chess.com. Cada lance é comparado com a melhor jogada do
          Stockfish e recebe um destes rótulos.
        </p>
        <dl className="mt-4 divide-y divide-divider overflow-hidden rounded-large bg-content1">
          {CLASS_DESCRIPTIONS.map(({ key, text }) => (
            <div key={key} className="flex items-start gap-3 px-4 py-3">
              <span aria-hidden className="mt-px flex">
                <ClassBadge classification={key} size={22} />
              </span>
              <div className="min-w-0">
                <dt className="font-medium">{CLASS_META[key].label}</dt>
                <dd className="text-sm text-foreground-500">{text}</dd>
              </div>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="perguntas">
        <h2 id="perguntas" className="text-xl font-semibold tracking-tight">
          Perguntas frequentes
        </h2>
        <div className="mt-4 flex flex-col gap-5">
          {FAQ.map(({ q, a }) => (
            <div key={q}>
              <h3 className="font-medium">{q}</h3>
              <p className="mt-0.5 text-foreground-500">{a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

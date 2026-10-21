import { renderToString } from 'react-dom/server'
import { Root } from './Root.tsx'

/** Usado só no build (plugin seo em vite.config.ts): HTML estático da página inicial. */
export function render() {
  return renderToString(<Root />)
}

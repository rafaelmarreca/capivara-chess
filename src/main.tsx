import { createRoot } from 'react-dom/client'
import './index.css'
import { Root } from './Root.tsx'

// O #root chega com a página inicial pré-renderizada no build (para buscadores e para quem
// está sem JS). createRoot substitui esse HTML pela mesma marcação, agora interativa.
createRoot(document.getElementById('root')!).render(<Root />)

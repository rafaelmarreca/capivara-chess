import { useEffect, useState } from 'react'

const QUERY = '(max-width: 1023px) and (orientation: portrait)'

/** Celular em retrato: a revisão usa o layout de uma tela só. No pré-render, sempre false. */
export function useCompactLayout(): boolean {
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.matchMedia(QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const update = () => setCompact(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return compact
}

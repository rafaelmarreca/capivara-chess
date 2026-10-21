const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** Data curta da lista de análises: "hoje", "ontem", "12 out" ou "3 jan 2025". */
export function savedDate(ts: number, now = Date.now()): string {
  const d = new Date(ts)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const day = new Date(d)
  day.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000)
  if (diff === 0) return 'hoje'
  if (diff === 1) return 'ontem'
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`
  return d.getFullYear() === today.getFullYear() ? base : `${base} ${d.getFullYear()}`
}

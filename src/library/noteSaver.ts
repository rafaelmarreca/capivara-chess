export type NoteKey = number | 'comment'

export interface NoteSaver {
  /** Agenda a gravação; digitar de novo antes do prazo só troca o texto. */
  set(key: NoteKey, text: string): void
  /** Grava agora tudo o que está pendente (troca de lance, saída da partida, logout). */
  flush(): Promise<void>
  pending(): boolean
}

/** Salvamento com debounce por chave, para não gravar a cada tecla. */
export function createNoteSaver(write: (key: NoteKey, text: string) => Promise<void>, delayMs = 1000): NoteSaver {
  const queued = new Map<NoteKey, string>()
  let timer: ReturnType<typeof setTimeout> | undefined

  const flush = async () => {
    clearTimeout(timer)
    timer = undefined
    const batch = [...queued]
    queued.clear()
    await Promise.all(batch.map(([k, t]) => write(k, t).catch(() => {})))
  }

  return {
    set(key, text) {
      queued.set(key, text)
      clearTimeout(timer)
      timer = setTimeout(flush, delayMs)
    },
    flush,
    pending: () => queued.size > 0,
  }
}

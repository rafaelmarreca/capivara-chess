import type { GameRepo } from './repo'
import { mergeGames } from './merge'

/** Ao entrar na conta: sobe as análises feitas sem login, mesclando com as que já estão lá. */
export async function migrateLocalToRemote(local: GameRepo, remote: GameRepo): Promise<void> {
  for (const { id } of await local.list()) {
    const mine = await local.get(id)
    if (!mine) continue
    // Sem conseguir ler a conta, não sobrescreve nada: o local fica para a próxima tentativa
    const theirs = await remote.get(id)
    await remote.put(theirs ? mergeGames(theirs, mine) : mine)
  }
  await local.clear()
}

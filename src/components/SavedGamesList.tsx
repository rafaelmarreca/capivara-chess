import { useState } from 'react'
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Modal,
  Skeleton,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react'
import type { SavedGameMeta } from '../library/types'
import { noteCount } from '../library/repo'
import { savedDate } from '../library/format'
import { resultFor, sideOf } from '../library/identity'
import { IconMore } from './icons'

interface Props {
  games: SavedGameMeta[]
  myNames: string[]
  /** Login sendo confirmado: a lista ainda vai mudar (pode vir da conta) */
  loading?: boolean
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}

export function SavedGamesList({ games, myNames, loading, onOpen, onDelete }: Props) {
  const [confirming, setConfirming] = useState<string | null>(null)
  if (loading) {
    return (
      <div className="mt-10" aria-busy="true">
        <h2 className="text-lg font-semibold tracking-tight">Minhas análises</h2>
        <ul className="mt-3 divide-y divide-divider overflow-hidden rounded-large bg-content1">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center justify-between gap-4 px-4 py-3.5">
              <Skeleton className="h-4 w-2/3 rounded-small" />
              <Skeleton className="h-4 w-16 rounded-small" />
            </li>
          ))}
        </ul>
      </div>
    )
  }
  if (games.length === 0) return null

  return (
    <div className="mt-10">
      <h2 className="text-lg font-semibold tracking-tight">Minhas análises</h2>
      <ul className="mt-3 divide-y divide-divider overflow-hidden rounded-large bg-content1">
        {games.map((g) => {
          const h = g.headers
          const notes = noteCount(g)
          const side = sideOf(h, myNames)
          const mine = side && resultFor(h, side)
          const result = mine ?? (h.Result && h.Result !== '*' ? h.Result.replace('1/2', '½') : null)
          const name = (c: 'w' | 'b') => {
            const n = (c === 'w' ? h.White : h.Black) ?? (c === 'w' ? 'Brancas' : 'Pretas')
            return side === c ? <span className="text-primary">{n}</span> : n
          }
          return (
            <li key={g.id} className="flex items-center">
              <button
                onClick={() => onOpen(g.id)}
                className="flex min-w-0 flex-1 items-center justify-between gap-4 px-4 py-3 text-left outline-none hover:bg-content2 focus-visible:bg-content2"
              >
                <span className="min-w-0 truncate font-medium">
                  {name('w')} × {name('b')}
                  {result && (
                    <span
                      className={`ml-2 font-normal ${
                        mine === 'vitória' ? 'text-success' : mine === 'derrota' ? 'text-danger' : 'text-foreground-500'
                      }`}
                    >
                      {result}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-sm text-foreground-500">
                  {[savedDate(g.updatedAt), notes > 0 && `${notes} ${notes === 1 ? 'nota' : 'notas'}`]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </button>
              <Dropdown placement="bottom-end">
                <DropdownTrigger>
                  <Button isIconOnly size="sm" variant="light" className="mr-2" aria-label="Opções da análise">
                    <IconMore />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Opções da análise" onAction={() => setConfirming(g.id)}>
                  <DropdownItem key="delete" className="text-danger" color="danger">
                    Excluir
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </li>
          )
        })}
      </ul>

      <Modal isOpen={confirming != null} onOpenChange={(open) => !open && setConfirming(null)} size="sm">
        <ModalContent>
          {(close) => (
            <>
              <ModalHeader>Excluir esta análise?</ModalHeader>
              <ModalBody>
                <p className="text-sm text-foreground-500">As notas também serão apagadas.</p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={close}>
                  Cancelar
                </Button>
                <Button
                  color="danger"
                  onPress={() => {
                    if (confirming) onDelete(confirming)
                    close()
                  }}
                >
                  Excluir
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}

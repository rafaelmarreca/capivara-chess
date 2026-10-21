import { useState } from 'react'
import {
  Avatar,
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
  Modal,
  Tooltip,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react'
import type { Library } from '../library/useLibrary'

interface Props {
  library: Library
  /** Chamado depois de sair da conta (o App volta à tela inicial). */
  onSignedOut: () => void
}

export function AccountButton({ library, onSignedOut }: Props) {
  const [busy, setBusy] = useState(false)
  const [unsynced, setUnsynced] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tabsOpen, setTabsOpen] = useState(false)
  const { user } = library
  if (!library.configured) return null

  const signIn = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await library.signIn()
      if (result === 'blocked') setError('O navegador bloqueou a janela de login. Permita pop-ups para este site e tente de novo.')
    } catch {
      setError('Não foi possível entrar. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  const signOut = async (force = false) => {
    setBusy(true)
    setError(null)
    try {
      const result = await library.signOut(force)
      if (result === 'unsynced') return setUnsynced(true)
      setUnsynced(false)
      if (result === 'tabs-open') setTabsOpen(true)
      onSignedOut()
    } catch {
      setError('Não foi possível sair. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {user ? (
        <Dropdown placement="bottom-end">
          <DropdownTrigger>
            <button
              aria-label="Conta"
              className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <Avatar size="sm" src={user.photoURL} name={user.name} imgProps={{ referrerPolicy: 'no-referrer' }} />
            </button>
          </DropdownTrigger>
          <DropdownMenu aria-label="Conta" onAction={() => signOut()} disabledKeys={busy ? ['signout'] : []}>
            <DropdownSection showDivider title={user.name}>
              <DropdownItem key="info" isReadOnly className="cursor-default text-foreground-500">
                Análises sincronizadas com a conta
              </DropdownItem>
            </DropdownSection>
            <DropdownSection>
              <DropdownItem key="signout">Sair</DropdownItem>
            </DropdownSection>
          </DropdownMenu>
        </Dropdown>
      ) : (
        <Tooltip content={error} isOpen={!!error} placement="bottom-end" color="danger" className="max-w-64">
          <Button
            size="sm"
            variant="flat"
            isLoading={busy}
            onPress={signIn}
            onPointerEnter={library.prepare}
            onFocus={library.prepare}
          >
            {error ? 'Tentar de novo' : 'Entrar com Google'}
          </Button>
        </Tooltip>
      )}

      <Modal isOpen={tabsOpen} onOpenChange={(open) => !open && setTabsOpen(false)} size="sm">
        <ModalContent>
          {(close) => (
            <>
              <ModalHeader>Você saiu da conta</ModalHeader>
              <ModalBody>
                <p className="text-sm text-foreground-500">
                  Feche as outras abas do Capivara Chess para terminar de apagar os dados da conta deste aparelho.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button onPress={close}>Entendi</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal isOpen={unsynced} onOpenChange={(open) => !open && setUnsynced(false)} size="sm">
        <ModalContent>
          {(close) => (
            <>
              <ModalHeader>Sair da conta?</ModalHeader>
              <ModalBody>
                <p className="text-sm text-foreground-500">
                  Há notas ainda não sincronizadas. Sair agora vai perdê-las.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={close}>
                  Cancelar
                </Button>
                <Button color="danger" isLoading={busy} onPress={() => signOut(true)}>
                  Sair mesmo assim
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  )
}

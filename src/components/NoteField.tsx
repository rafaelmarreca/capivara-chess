import { useState } from 'react'
import { Textarea } from '@heroui/react'

interface Props {
  label: string
  value: string
  onChange: (text: string) => void
  placeholder?: string
  /** No celular: começa como uma linha "✎ Sua nota" e abre o campo ao tocar. */
  collapsible?: boolean
}

/** Campo de anotação do usuário; quem salva é o chamador (com debounce). */
export function NoteField({ label, value, onChange, placeholder, collapsible }: Props) {
  const [open, setOpen] = useState(false)
  if (collapsible && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="line-clamp-1 w-full rounded-medium border border-dashed border-default-300 px-3 py-1.5 text-left text-sm text-foreground-500 outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        ✎ {value || `${label}…`}
      </button>
    )
  }
  return (
    <Textarea
      label={label}
      labelPlacement="outside"
      placeholder={placeholder}
      minRows={2}
      value={value}
      onValueChange={onChange}
      autoFocus={collapsible}
      classNames={{ label: 'text-sm text-foreground-500' }}
    />
  )
}

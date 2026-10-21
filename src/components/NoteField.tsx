import { Textarea } from '@heroui/react'

interface Props {
  label: string
  value: string
  onChange: (text: string) => void
  placeholder?: string
}

/** Campo de anotação do usuário; quem salva é o chamador (com debounce). */
export function NoteField({ label, value, onChange, placeholder }: Props) {
  return (
    <Textarea
      label={label}
      labelPlacement="outside"
      placeholder={placeholder}
      minRows={2}
      value={value}
      onValueChange={onChange}
      classNames={{ label: 'text-sm text-foreground-500' }}
    />
  )
}

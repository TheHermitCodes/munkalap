'use client'

import { Button } from '@/components/ui'
import type { ComponentProps } from 'react'

type Props = Omit<ComponentProps<typeof Button>, 'type'> & { pending: boolean; pendingLabel?: string }

export function SubmitButton({ children, pending, pendingLabel, disabled, variant = 'primary', ...props }: Props) {
  return (
    <Button type="submit" variant={variant} disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  )
}

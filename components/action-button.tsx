'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { Button } from '@/components/ui'
import type { ActionState } from '@/lib/action-state'

type Props = {
  /** A Server Action with its arguments already bound. */
  action: () => Promise<ActionState | void>
  children: ReactNode
  pendingLabel?: string
  /** Ask before running, for destructive actions. */
  confirm?: string
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

/** A button that runs a Server Action and shows its error inline. */
export function ActionButton({ action, children, pendingLabel, confirm, variant = 'secondary', size = 'sm' }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run() {
    if (confirm && !window.confirm(confirm)) return
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (result?.status === 'error') setError(result.message)
    })
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button variant={variant} size={size} onClick={run} disabled={pending} aria-busy={pending}>
        {pending && pendingLabel ? pendingLabel : children}
      </Button>
      {error && (
        <span role="alert" className="max-w-xs text-right text-xs text-red-700">
          {error}
        </span>
      )}
    </span>
  )
}

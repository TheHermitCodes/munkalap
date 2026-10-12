'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { idle, type ActionState } from '@/lib/action-state'

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>

/**
 * Submits a form to a Server Action and tracks its result.
 *
 * Why not <form action={...}> + useActionState: React resets uncontrolled
 * forms after every action, so a validation error would wipe what the user
 * typed. Here the form is only reset when we ask for it.
 */
export function useFormAction(action: FormAction, options: { resetOnSuccess?: boolean } = {}) {
  const [state, setState] = useState<ActionState>(idle)
  const [pending, startTransition] = useTransition()

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    startTransition(async () => {
      const result = await action(state, formData)
      // Actions that redirect never hand a result back.
      if (!result) return
      setState(result)
      if (result.status === 'success' && options.resetOnSuccess) form.reset()
    })
  }

  return { state, pending, onSubmit }
}

'use client'

import { FormStatus } from '@/components/form-status'
import { SubmitButton } from '@/components/submit-button'
import { Textarea } from '@/components/ui'
import { useFormAction } from '@/components/use-form-action'
import type { ActionState } from '@/lib/action-state'

export function CommentForm({ action }: { action: (prev: ActionState, formData: FormData) => Promise<ActionState> }) {
  const { state, pending, onSubmit } = useFormAction(action, { resetOnSuccess: true })
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {state.status === 'error' && <FormStatus state={state} />}
      <label htmlFor="comment" className="sr-only">
        Add a comment
      </label>
      <Textarea id="comment" name="body" rows={3} required maxLength={5000} placeholder="Add a note for the team…" />
      <div className="flex justify-end">
        <SubmitButton pending={pending} pendingLabel="Posting…" size="sm">
          Comment
        </SubmitButton>
      </div>
    </form>
  )
}

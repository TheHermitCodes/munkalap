'use client'

import { useState } from 'react'
import { FormStatus } from '@/components/form-status'
import { SubmitButton } from '@/components/submit-button'
import { Button, Field, Input, Textarea } from '@/components/ui'
import { useFormAction } from '@/components/use-form-action'
import type { ActionState } from '@/lib/action-state'

type Props = {
  title: string
  description: string
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
}

export function WorkOrderDetails({ title, description, action }: Props) {
  const [editing, setEditing] = useState(false)

  if (!editing) {
    return (
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          {description ? (
            <p className="text-sm leading-6 whitespace-pre-wrap text-stone-700">{description}</p>
          ) : (
            <p className="text-sm text-stone-400 italic">No description.</p>
          )}
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
      </div>
    )
  }

  return <EditForm title={title} description={description} action={action} onDone={() => setEditing(false)} />
}

function EditForm({ title, description, action, onDone }: Props & { onDone: () => void }) {
  const { state, pending, onSubmit } = useFormAction(async (prev, formData) => {
    const result = await action(prev, formData)
    if (result.status === 'success') onDone()
    return result
  })

  return (
    <form onSubmit={onSubmit} className="space-y-4 px-5 py-4">
      <FormStatus state={state} />
      <Field label="Title" htmlFor="edit-title">
        <Input id="edit-title" name="title" defaultValue={title} required maxLength={200} />
      </Field>
      <Field label="Description" htmlFor="edit-description">
        <Textarea id="edit-description" name="description" defaultValue={description} rows={6} maxLength={10000} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <SubmitButton pending={pending} pendingLabel="Saving…">
          Save
        </SubmitButton>
      </div>
    </form>
  )
}

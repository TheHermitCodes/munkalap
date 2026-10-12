'use client'

import { FormStatus } from '@/components/form-status'
import { SubmitButton } from '@/components/submit-button'
import { ButtonLink, Field, Input, Select, Textarea } from '@/components/ui'
import { useFormAction } from '@/components/use-form-action'
import type { ActionState } from '@/lib/action-state'
import { PRIORITIES, PRIORITY_LABELS } from '@/lib/work-orders'

type Option = { id: string; name: string }

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  customers: Option[]
  members: Option[]
  defaultCustomerId?: string
  cancelHref: string
}

export function WorkOrderForm({ action, customers, members, defaultCustomerId, cancelHref }: Props) {
  const { state, pending, onSubmit } = useFormAction(action)

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormStatus state={state} />
      <Field label="Title" htmlFor="title">
        <Input id="title" name="title" required maxLength={200} autoFocus placeholder="e.g. Replace brake pads" />
      </Field>
      <Field label="Description" htmlFor="description" hint="What's wrong, what was agreed, anything the next person needs to know.">
        <Textarea id="description" name="description" rows={5} maxLength={10000} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Customer" htmlFor="customer_id">
          <Select id="customer_id" name="customer_id" defaultValue={defaultCustomerId ?? ''}>
            <option value="">No customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Assignee" htmlFor="assignee_id">
          <Select id="assignee_id" name="assignee_id" defaultValue="">
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority" htmlFor="priority">
          <Select id="priority" name="priority" defaultValue="normal">
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due date" htmlFor="due_date">
          <Input id="due_date" name="due_date" type="date" />
        </Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-stone-200 pt-5">
        <ButtonLink href={cancelHref} variant="ghost">
          Cancel
        </ButtonLink>
        <SubmitButton pending={pending} pendingLabel="Creating…">
          Create work order
        </SubmitButton>
      </div>
    </form>
  )
}

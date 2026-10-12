'use client'

import { FormStatus } from '@/components/form-status'
import { SubmitButton } from '@/components/submit-button'
import { Field, Input, Textarea } from '@/components/ui'
import { useFormAction } from '@/components/use-form-action'
import type { ActionState } from '@/lib/action-state'
import type { Tables } from '@/lib/database.types'

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  customer?: Pick<Tables<'customers'>, 'name' | 'email' | 'phone' | 'address' | 'notes'>
  submitLabel: string
}

export function CustomerForm({ action, customer, submitLabel }: Props) {
  const { state, pending, onSubmit } = useFormAction(action)
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormStatus state={state} />
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" defaultValue={customer?.name} required maxLength={120} autoComplete="off" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" defaultValue={customer?.email ?? ''} maxLength={254} autoComplete="off" />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <Input id="phone" name="phone" type="tel" defaultValue={customer?.phone ?? ''} maxLength={40} autoComplete="off" />
        </Field>
      </div>
      <Field label="Address" htmlFor="address">
        <Input id="address" name="address" defaultValue={customer?.address ?? ''} maxLength={300} autoComplete="off" />
      </Field>
      <Field label="Notes" htmlFor="notes" hint="Preferences, billing arrangements, anything worth remembering.">
        <Textarea id="notes" name="notes" defaultValue={customer?.notes ?? ''} rows={3} maxLength={2000} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pending={pending} pendingLabel="Saving…">
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  )
}

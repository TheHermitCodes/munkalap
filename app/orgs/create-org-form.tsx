'use client'

import { FormStatus } from '@/components/form-status'
import { SubmitButton } from '@/components/submit-button'
import { Input } from '@/components/ui'
import { useFormAction } from '@/components/use-form-action'
import { createOrganization } from './actions'

export function CreateOrgForm() {
  const { state, pending, onSubmit } = useFormAction(createOrganization)
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <FormStatus state={state} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="org-name" className="sr-only">
          Organization name
        </label>
        <Input id="org-name" name="name" placeholder="e.g. Kovács Bike Service" required maxLength={80} />
        <SubmitButton pending={pending} pendingLabel="Creating…">
          Create organization
        </SubmitButton>
      </div>
    </form>
  )
}

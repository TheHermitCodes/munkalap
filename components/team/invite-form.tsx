'use client'

import { FormStatus } from '@/components/form-status'
import { SubmitButton } from '@/components/submit-button'
import { Input, Select } from '@/components/ui'
import { useFormAction } from '@/components/use-form-action'
import type { ActionState } from '@/lib/action-state'

export function InviteForm({ action }: { action: (prev: ActionState, formData: FormData) => Promise<ActionState> }) {
  const { state, pending, onSubmit } = useFormAction(action, { resetOnSuccess: true })
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <FormStatus state={state} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="invite-email" className="sr-only">
          Email address
        </label>
        <Input id="invite-email" name="email" type="email" required placeholder="colleague@example.com" autoComplete="off" />
        <label htmlFor="invite-role" className="sr-only">
          Role
        </label>
        <Select id="invite-role" name="role" defaultValue="member" className="sm:w-36">
          <option value="member">Member</option>
          <option value="owner">Owner</option>
        </Select>
        <SubmitButton pending={pending} pendingLabel="Inviting…">
          Invite
        </SubmitButton>
      </div>
    </form>
  )
}

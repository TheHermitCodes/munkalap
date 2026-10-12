'use client'

import { useState, useTransition } from 'react'
import { changeRole } from '@/app/o/[orgId]/team/actions'
import { Select } from '@/components/ui'
import type { Enums } from '@/lib/database.types'

type Role = Enums<'org_role'>

export function RoleSelect({ orgId, userId, role, label }: { orgId: string; userId: string; role: Role; label: string }) {
  const [value, setValue] = useState(role)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function change(next: Role) {
    setValue(next)
    setError(null)
    startTransition(async () => {
      const result = await changeRole(orgId, userId, next)
      if (result.status === 'error') {
        setValue(role)
        setError(result.message)
      }
    })
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Select
        aria-label={`Role for ${label}`}
        value={value}
        disabled={pending}
        onChange={(e) => change(e.target.value as Role)}
        className="h-8 w-28 py-0 text-sm"
      >
        <option value="member">Member</option>
        <option value="owner">Owner</option>
      </Select>
      {error && (
        <span role="alert" className="max-w-56 text-right text-xs text-red-700">
          {error}
        </span>
      )}
    </span>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { updateWorkOrderField } from '@/app/o/[orgId]/work-orders/actions'
import { Field, Input, Select } from '@/components/ui'
import { PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS, type WorkOrderPriority, type WorkOrderStatus } from '@/lib/work-orders'

type Values = {
  status: WorkOrderStatus
  priority: WorkOrderPriority
  assignee_id: string | null
  customer_id: string | null
  due_date: string | null
}

type Props = {
  orgId: string
  workOrderId: string
  values: Values
  members: { id: string; name: string }[]
  customers: { id: string; name: string }[]
}

/**
 * Sidebar fields that save as soon as they change. The UI updates
 * optimistically and rolls back if the server says no. The parent remounts
 * this component (via `key`) whenever the saved work order changes.
 */
export function WorkOrderFields({ orgId, workOrderId, values: saved, members, customers }: Props) {
  const [values, setValues] = useState(saved)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save<K extends keyof Values>(field: K, raw: string) {
    const value = (raw === '' ? null : raw) as Values[K]
    const previous = values
    setValues({ ...values, [field]: value })
    setError(null)
    startTransition(async () => {
      const result = await updateWorkOrderField(orgId, workOrderId, { field, value })
      if (result.status === 'error') {
        setValues(previous)
        setError(result.message)
      }
    })
  }

  return (
    <div className="space-y-4" aria-busy={pending}>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <Field label="Status" htmlFor="status">
        <Select id="status" value={values.status} onChange={(e) => save('status', e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Assignee" htmlFor="assignee">
        <Select id="assignee" value={values.assignee_id ?? ''} onChange={(e) => save('assignee_id', e.target.value)}>
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Priority" htmlFor="priority">
        <Select id="priority" value={values.priority} onChange={(e) => save('priority', e.target.value)}>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Customer" htmlFor="customer">
        <Select id="customer" value={values.customer_id ?? ''} onChange={(e) => save('customer_id', e.target.value)}>
          <option value="">No customer</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Due date" htmlFor="due_date">
        <Input id="due_date" type="date" value={values.due_date ?? ''} onChange={(e) => save('due_date', e.target.value)} />
      </Field>
    </div>
  )
}

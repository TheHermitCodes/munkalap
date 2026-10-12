import Link from 'next/link'
import { PriorityBadge, StatusBadge } from '@/components/badges'
import { cn } from '@/components/ui'
import type { WorkOrderListItem } from '@/lib/data'
import { formatDate } from '@/lib/format'
import { isOverdue } from '@/lib/work-orders'

type Props = {
  orgId: string
  items: WorkOrderListItem[]
  memberNames: Map<string, string>
  today: string
  showCustomer?: boolean
}

export function WorkOrderList({ orgId, items, memberNames, today, showCustomer = true }: Props) {
  return (
    <div>
      <div className="hidden gap-4 border-b border-stone-200 px-5 py-2.5 text-xs font-medium tracking-wide text-stone-500 uppercase sm:flex">
        <span className="flex-1 pl-15">Work order</span>
        <span className="w-28">Status</span>
        <span className="w-32">Assignee</span>
        <span className="w-24 text-right">Due</span>
      </div>
      <ul className="divide-y divide-stone-100">
        {items.map((wo) => {
          const overdue = isOverdue(wo.due_date, wo.status, today)
          const assignee = wo.assignee_id ? (memberNames.get(wo.assignee_id) ?? 'Former member') : null
          return (
            <li key={wo.id}>
              <Link
                href={`/o/${orgId}/work-orders/${wo.number}`}
                className="flex flex-col gap-2 px-5 py-3.5 transition-colors hover:bg-stone-50 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="w-12 shrink-0 pt-px font-mono text-sm text-stone-500 tabular-nums">#{wo.number}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-stone-900">{wo.title}</span>
                      {(wo.priority === 'high' || wo.priority === 'urgent') && <PriorityBadge priority={wo.priority} />}
                    </div>
                    {showCustomer && wo.customer && (
                      <span className="block truncate text-sm text-stone-500">{wo.customer.name}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 pl-15 text-sm sm:gap-4 sm:pl-0">
                  <span className="sm:w-28">
                    <StatusBadge status={wo.status} />
                  </span>
                  <span className={cn('truncate sm:w-32', assignee ? 'text-stone-700' : 'text-stone-400')}>
                    {assignee ?? 'Unassigned'}
                  </span>
                  <span
                    className={cn(
                      'ml-auto tabular-nums sm:ml-0 sm:w-24 sm:text-right',
                      overdue ? 'font-medium text-red-700' : 'text-stone-500',
                    )}
                    title={overdue ? 'Overdue' : undefined}
                  >
                    {wo.due_date ? formatDate(wo.due_date) : <span className="text-stone-300">—</span>}
                  </span>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

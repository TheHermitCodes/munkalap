import { Badge } from '@/components/ui'
import type { Enums } from '@/lib/database.types'
import { PRIORITY_LABELS, STATUS_LABELS, type WorkOrderPriority, type WorkOrderStatus } from '@/lib/work-orders'

const statusTones = {
  open: 'blue',
  in_progress: 'amber',
  waiting: 'violet',
  done: 'green',
  cancelled: 'neutral',
} as const satisfies Record<WorkOrderStatus, string>

const priorityTones = {
  low: 'neutral',
  normal: 'neutral',
  high: 'orange',
  urgent: 'red',
} as const satisfies Record<WorkOrderPriority, string>

export function StatusBadge({ status }: { status: WorkOrderStatus }) {
  return <Badge tone={statusTones[status]}>{STATUS_LABELS[status]}</Badge>
}

export function PriorityBadge({ priority }: { priority: WorkOrderPriority }) {
  return <Badge tone={priorityTones[priority]}>{PRIORITY_LABELS[priority]}</Badge>
}

export function RoleBadge({ role }: { role: Enums<'org_role'> }) {
  return <Badge tone={role === 'owner' ? 'green' : 'neutral'}>{role === 'owner' ? 'Owner' : 'Member'}</Badge>
}

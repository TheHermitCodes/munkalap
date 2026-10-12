import { Constants, type Enums } from './database.types'

export type WorkOrderStatus = Enums<'work_order_status'>
export type WorkOrderPriority = Enums<'work_order_priority'>

// Runtime lists come from the generated types, so adding an enum value in a
// migration and regenerating types makes TypeScript point at every label map
// below that needs a new entry.
export const STATUSES = Constants.public.Enums.work_order_status
export const PRIORITIES = Constants.public.Enums.work_order_priority

export const OPEN_STATUSES = ['open', 'in_progress', 'waiting'] as const satisfies readonly WorkOrderStatus[]
export const CLOSED_STATUSES = ['done', 'cancelled'] as const satisfies readonly WorkOrderStatus[]

export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  waiting: 'Waiting',
  done: 'Done',
  cancelled: 'Cancelled',
}

export const PRIORITY_LABELS: Record<WorkOrderPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
}

export function isClosed(status: WorkOrderStatus): boolean {
  return (CLOSED_STATUSES as readonly WorkOrderStatus[]).includes(status)
}

/** Due dates are plain dates (YYYY-MM-DD), so string comparison is date comparison. */
export function isOverdue(dueDate: string | null, status: WorkOrderStatus, today: string): boolean {
  return dueDate !== null && !isClosed(status) && dueDate < today
}

// -- List filters (kept in the URL so views can be bookmarked and shared) ------

export type WorkOrderView = 'open' | 'closed' | 'all'
export type WorkOrderFilters = { view: WorkOrderView; mine: boolean; q: string }

type SearchParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function parseWorkOrderFilters(params: SearchParams): WorkOrderFilters {
  const view = first(params.view)
  return {
    view: view === 'closed' || view === 'all' ? view : 'open',
    mine: first(params.mine) === '1',
    q: (first(params.q) ?? '').trim().slice(0, 100),
  }
}

export function workOrderListHref(orgId: string, filters: WorkOrderFilters): string {
  const params = new URLSearchParams()
  if (filters.view !== 'open') params.set('view', filters.view)
  if (filters.mine) params.set('mine', '1')
  if (filters.q) params.set('q', filters.q)
  const query = params.toString()
  return `/o/${orgId}/work-orders${query ? `?${query}` : ''}`
}

/** "#42" or "42" searches by number; anything else searches titles. */
export function parseSearch(q: string): { number: number } | { text: string } | null {
  const trimmed = q.trim()
  if (!trimmed) return null
  const match = /^#?(\d{1,9})$/.exec(trimmed)
  if (match) return { number: Number(match[1]) }
  return { text: trimmed }
}

/** Escapes LIKE wildcards so a search for "50%" means the literal text. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`)
}

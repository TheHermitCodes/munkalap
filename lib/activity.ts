import type { Enums, Json } from './database.types'
import { STATUS_LABELS, STATUSES, type WorkOrderStatus } from './work-orders'

type ActivityEvent = {
  type: Enums<'work_order_event_type'>
  payload: Json
  actor_id: string | null
}

/** Reads a string field from an event payload without trusting its shape. */
function payloadString(payload: Json, key: string): string | null {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return null
  const value = payload[key]
  return typeof value === 'string' ? value : null
}

function statusLabel(value: string | null): string {
  return value && (STATUSES as readonly string[]).includes(value)
    ? STATUS_LABELS[value as WorkOrderStatus]
    : 'an unknown status'
}

/**
 * One line of the activity timeline. `names` maps user ids to display names
 * for current members; anyone missing from it has left the organization.
 */
export function describeEvent(event: ActivityEvent, names: Map<string, string>): string {
  const person = (id: string) => names.get(id) ?? 'a former member'
  const actor = event.actor_id ? (names.get(event.actor_id) ?? 'A former member') : 'Someone'

  switch (event.type) {
    case 'created':
      return `${actor} created this work order`
    case 'status_changed':
      return `${actor} changed the status from ${statusLabel(payloadString(event.payload, 'from'))} to ${statusLabel(payloadString(event.payload, 'to'))}`
    case 'assigned': {
      const to = payloadString(event.payload, 'to')
      const from = payloadString(event.payload, 'from')
      if (to === null) return from ? `${actor} unassigned ${person(from)}` : `${actor} removed the assignee`
      if (to === event.actor_id) return `${actor} took this work order`
      return `${actor} assigned it to ${person(to)}`
    }
    case 'comment':
      return `${actor} commented`
  }
}

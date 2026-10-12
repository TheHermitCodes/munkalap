import { describeEvent } from '@/lib/activity'
import type { Json, Enums } from '@/lib/database.types'
import { formatDateTime, timeAgo } from '@/lib/format'

type Event = {
  id: number
  type: Enums<'work_order_event_type'>
  body: string | null
  payload: Json
  actor_id: string | null
  created_at: string
}

export function Activity({ events, memberNames }: { events: Event[]; memberNames: Map<string, string> }) {
  return (
    <ol className="space-y-4">
      {events.map((event) => (
        <li key={event.id} className="flex gap-3">
          <span
            aria-hidden
            className={
              event.type === 'comment'
                ? 'mt-1.5 size-2 shrink-0 rounded-full bg-emerald-600'
                : 'mt-1.5 size-2 shrink-0 rounded-full bg-stone-300'
            }
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-stone-600">
              {describeEvent(event, memberNames)}{' '}
              <time dateTime={event.created_at} title={formatDateTime(event.created_at)} className="text-stone-400">
                · {timeAgo(event.created_at)}
              </time>
            </p>
            {event.body && (
              <p className="mt-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm whitespace-pre-wrap text-stone-800">
                {event.body}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

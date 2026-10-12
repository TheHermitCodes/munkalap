import Form from 'next/form'
import Link from 'next/link'
import { cn, Input } from '@/components/ui'
import { workOrderListHref, type WorkOrderFilters as Filters, type WorkOrderView } from '@/lib/work-orders'

const VIEWS: { view: WorkOrderView; label: string }[] = [
  { view: 'open', label: 'Open' },
  { view: 'closed', label: 'Closed' },
  { view: 'all', label: 'All' },
]

/** Filters live in the URL: plain links and a GET form, no client state. */
export function WorkOrderFilters({ orgId, filters }: { orgId: string; filters: Filters }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg border border-stone-200 bg-white p-0.5 shadow-xs">
        {VIEWS.map(({ view, label }) => (
          <Link
            key={view}
            href={workOrderListHref(orgId, { ...filters, view })}
            aria-current={filters.view === view ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              filters.view === view ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900',
            )}
          >
            {label}
          </Link>
        ))}
      </div>
      <Link
        href={workOrderListHref(orgId, { ...filters, mine: !filters.mine })}
        className={cn(
          'rounded-lg border px-3 py-1.5 text-sm font-medium shadow-xs transition-colors',
          filters.mine
            ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
            : 'border-stone-200 bg-white text-stone-600 hover:text-stone-900',
        )}
      >
        {filters.mine ? '✓ ' : ''}Assigned to me
      </Link>
      <Form action={`/o/${orgId}/work-orders`} className="w-full sm:ml-auto sm:w-64">
        {filters.view !== 'open' && <input type="hidden" name="view" value={filters.view} />}
        {filters.mine && <input type="hidden" name="mine" value="1" />}
        <Input
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Search title or #number"
          aria-label="Search work orders"
          className="h-9"
        />
      </Form>
    </div>
  )
}

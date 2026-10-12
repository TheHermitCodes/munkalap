import type { Metadata } from 'next'
import { ButtonLink, Card, EmptyState, PageHeader } from '@/components/ui'
import { WorkOrderFilters } from '@/components/work-orders/work-order-filters'
import { WorkOrderList } from '@/components/work-orders/work-order-list'
import { getMemberNames, getOrgContext, listWorkOrders } from '@/lib/data'
import { todayIso } from '@/lib/format'
import { parseWorkOrderFilters, workOrderListHref } from '@/lib/work-orders'

export const metadata: Metadata = { title: 'Work orders' }

type Props = {
  params: Promise<{ orgId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function WorkOrdersPage({ params, searchParams }: Props) {
  const { orgId } = await params
  const { org, user } = await getOrgContext(orgId)
  const filters = parseWorkOrderFilters(await searchParams)
  const [workOrders, memberNames] = await Promise.all([
    listWorkOrders(orgId, { ...filters, userId: user.id }),
    getMemberNames(orgId),
  ])
  const isFiltered = filters.mine || filters.q !== '' || filters.view !== 'open'

  return (
    <>
      <PageHeader
        title="Work orders"
        description={org.name}
        actions={
          <ButtonLink href={`/o/${orgId}/work-orders/new`} variant="primary">
            New work order
          </ButtonLink>
        }
      />
      <WorkOrderFilters orgId={orgId} filters={filters} />
      <Card>
        {workOrders.length > 0 ? (
          <WorkOrderList orgId={orgId} items={workOrders} memberNames={memberNames} today={todayIso()} />
        ) : isFiltered ? (
          <EmptyState
            title="Nothing matches these filters"
            action={
              <ButtonLink href={workOrderListHref(orgId, { view: 'open', mine: false, q: '' })} size="sm">
                Clear filters
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            title="No open work orders"
            action={
              <ButtonLink href={`/o/${orgId}/work-orders/new`} variant="primary" size="sm">
                Create the first one
              </ButtonLink>
            }
          >
            Track every repair, job or service request from intake to done.
          </EmptyState>
        )}
      </Card>
    </>
  )
}

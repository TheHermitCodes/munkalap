import type { Metadata } from 'next'
import Link from 'next/link'
import { ActionButton } from '@/components/action-button'
import { CustomerForm } from '@/components/customers/customer-form'
import { ButtonLink, Card, CardHeader, EmptyState, PageHeader } from '@/components/ui'
import { WorkOrderList } from '@/components/work-orders/work-order-list'
import { getCustomer, getMemberNames, getOrgContext, listWorkOrders } from '@/lib/data'
import { todayIso } from '@/lib/format'
import { deleteCustomer, updateCustomer } from '../actions'

export const metadata: Metadata = { title: 'Customer' }

type Props = { params: Promise<{ orgId: string; customerId: string }> }

export default async function CustomerPage({ params }: Props) {
  const { orgId, customerId } = await params
  const { isOwner } = await getOrgContext(orgId)
  const customer = await getCustomer(orgId, customerId)
  const [workOrders, memberNames] = await Promise.all([
    listWorkOrders(orgId, { view: 'all', mine: false, q: '', customerId }),
    getMemberNames(orgId),
  ])

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href={`/o/${orgId}/customers`} className="hover:text-stone-900">
            ← Customers
          </Link>
        }
        title={customer.name}
        actions={
          <>
            {isOwner && (
              <ActionButton
                action={deleteCustomer.bind(null, orgId, customer.id)}
                variant="danger"
                size="md"
                confirm={`Delete ${customer.name}?`}
                pendingLabel="Deleting…"
              >
                Delete
              </ActionButton>
            )}
            <ButtonLink href={`/o/${orgId}/work-orders/new?customer=${customer.id}`} variant="primary">
              New work order
            </ButtonLink>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="min-w-0 self-start">
          <CardHeader title="Work orders" description={`${workOrders.length} in total`} />
          {workOrders.length === 0 ? (
            <EmptyState title="No work orders for this customer yet" />
          ) : (
            <WorkOrderList
              orgId={orgId}
              items={workOrders}
              memberNames={memberNames}
              today={todayIso()}
              showCustomer={false}
            />
          )}
        </Card>
        <Card className="self-start">
          <CardHeader title="Details" />
          <div className="p-5">
            <CustomerForm
              action={updateCustomer.bind(null, orgId, customer.id)}
              customer={customer}
              submitLabel="Save changes"
            />
          </div>
        </Card>
      </div>
    </>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { ButtonLink, Card, EmptyState, PageHeader } from '@/components/ui'
import { getOrgContext, listCustomers } from '@/lib/data'

export const metadata: Metadata = { title: 'Customers' }

export default async function CustomersPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const { org } = await getOrgContext(orgId)
  const customers = await listCustomers(orgId)

  return (
    <>
      <PageHeader
        title="Customers"
        description={org.name}
        actions={
          <ButtonLink href={`/o/${orgId}/customers/new`} variant="primary">
            New customer
          </ButtonLink>
        }
      />
      <Card>
        {customers.length === 0 ? (
          <EmptyState title="No customers yet">Add the people and companies you do work for.</EmptyState>
        ) : (
          <ul className="divide-y divide-stone-100">
            {customers.map((customer) => (
              <li key={customer.id}>
                <Link
                  href={`/o/${orgId}/customers/${customer.id}`}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3.5 transition-colors hover:bg-stone-50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{customer.name}</p>
                    <p className="truncate text-sm text-stone-500">
                      {[customer.phone, customer.email].filter(Boolean).join(' · ') || 'No contact details'}
                    </p>
                  </div>
                  <span className="text-sm text-stone-500 tabular-nums">
                    {customer.workOrderCount} work order{customer.workOrderCount === 1 ? '' : 's'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { CustomerForm } from '@/components/customers/customer-form'
import { Card, PageHeader } from '@/components/ui'
import { getOrgContext } from '@/lib/data'
import { createCustomer } from '../actions'

export const metadata: Metadata = { title: 'New customer' }

export default async function NewCustomerPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  await getOrgContext(orgId)

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href={`/o/${orgId}/customers`} className="hover:text-stone-900">
            ← Customers
          </Link>
        }
        title="New customer"
      />
      <Card className="max-w-2xl p-6">
        <CustomerForm action={createCustomer.bind(null, orgId)} submitLabel="Add customer" />
      </Card>
    </>
  )
}

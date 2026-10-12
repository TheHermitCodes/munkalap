import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, PageHeader } from '@/components/ui'
import { WorkOrderForm } from '@/components/work-orders/work-order-form'
import { getCustomerOptions, getMembers, getOrgContext } from '@/lib/data'
import { isId } from '@/lib/validation'
import { createWorkOrder } from '../actions'

export const metadata: Metadata = { title: 'New work order' }

type Props = {
  params: Promise<{ orgId: string }>
  searchParams: Promise<{ customer?: string }>
}

export default async function NewWorkOrderPage({ params, searchParams }: Props) {
  const { orgId } = await params
  const { customer } = await searchParams
  await getOrgContext(orgId)
  const [customers, members] = await Promise.all([getCustomerOptions(orgId), getMembers(orgId)])

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href={`/o/${orgId}/work-orders`} className="hover:text-stone-900">
            ← Work orders
          </Link>
        }
        title="New work order"
      />
      <Card className="max-w-2xl p-6">
        <WorkOrderForm
          action={createWorkOrder.bind(null, orgId)}
          customers={customers}
          members={members.map((m) => ({ id: m.userId, name: m.name }))}
          defaultCustomerId={isId(customer) ? customer : undefined}
          cancelHref={`/o/${orgId}/work-orders`}
        />
      </Card>
    </>
  )
}

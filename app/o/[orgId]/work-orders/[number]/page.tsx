import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ActionButton } from '@/components/action-button'
import { StatusBadge } from '@/components/badges'
import { Card, CardHeader, PageHeader } from '@/components/ui'
import { Activity } from '@/components/work-orders/activity'
import { AttachmentUploader } from '@/components/work-orders/attachment-uploader'
import { CommentForm } from '@/components/work-orders/comment-form'
import { WorkOrderDetails } from '@/components/work-orders/work-order-details'
import { WorkOrderFields } from '@/components/work-orders/work-order-fields'
import { getAttachments, getCustomerOptions, getMembers, getOrgContext, getWorkOrder, getWorkOrderEvents } from '@/lib/data'
import { formatBytes, formatDate, formatDateTime, todayIso } from '@/lib/format'
import { isOverdue } from '@/lib/work-orders'
import { addComment, deleteAttachment, deleteWorkOrder, updateWorkOrderDetails } from '../actions'

type Props = { params: Promise<{ orgId: string; number: string }> }

function parseNumber(value: string): number {
  if (!/^\d{1,9}$/.test(value)) notFound()
  return Number(value)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { number } = await params
  return { title: `Work order #${number}` }
}

export default async function WorkOrderPage({ params }: Props) {
  const { orgId, number } = await params
  const { isOwner } = await getOrgContext(orgId)
  const workOrder = await getWorkOrder(orgId, parseNumber(number))
  const [events, members, customers, attachments] = await Promise.all([
    getWorkOrderEvents(workOrder.id),
    getMembers(orgId),
    getCustomerOptions(orgId),
    getAttachments(orgId, workOrder.id),
  ])
  const memberNames = new Map(members.map((m) => [m.userId, m.name]))
  const overdue = isOverdue(workOrder.due_date, workOrder.status, todayIso())

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href={`/o/${orgId}/work-orders`} className="hover:text-stone-900">
            ← Work orders
          </Link>
        }
        title={
          <>
            <span className="mr-2 font-mono font-normal text-stone-400">#{workOrder.number}</span>
            {workOrder.title}
          </>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={workOrder.status} />
            {workOrder.customer && (
              <Link href={`/o/${orgId}/customers/${workOrder.customer.id}`} className="hover:text-stone-900">
                {workOrder.customer.name}
              </Link>
            )}
            {overdue && workOrder.due_date && (
              <span className="font-medium text-red-700">Overdue since {formatDate(workOrder.due_date)}</span>
            )}
          </span>
        }
        actions={
          isOwner && (
            <ActionButton
              action={deleteWorkOrder.bind(null, orgId, workOrder.id)}
              variant="danger"
              confirm={`Delete work order #${workOrder.number}, its activity and its attachments? This can't be undone.`}
              pendingLabel="Deleting…"
            >
              Delete
            </ActionButton>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Details" />
            <WorkOrderDetails
              title={workOrder.title}
              description={workOrder.description}
              action={updateWorkOrderDetails.bind(null, orgId, workOrder.id)}
            />
          </Card>

          <Card>
            <CardHeader
              title="Attachments"
              description="Photos, quotes and invoices. Up to 10 MB each."
              actions={<AttachmentUploader orgId={orgId} workOrderId={workOrder.id} />}
            />
            {attachments.length === 0 ? (
              <p className="px-5 py-4 text-sm text-stone-400">No files yet.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {attachments.map((file) => (
                  <li key={file.path} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      {file.url ? (
                        <a href={file.url} className="block truncate text-sm font-medium text-emerald-800 hover:underline">
                          {file.name}
                        </a>
                      ) : (
                        <span className="block truncate text-sm font-medium">{file.name}</span>
                      )}
                      <span className="text-xs text-stone-500">
                        {[file.size !== null && formatBytes(file.size), file.createdAt && formatDateTime(file.createdAt)]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                    <ActionButton
                      action={deleteAttachment.bind(null, orgId, workOrder.id, file.path)}
                      variant="ghost"
                      confirm={`Delete ${file.name}?`}
                      pendingLabel="Deleting…"
                    >
                      Delete
                    </ActionButton>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Activity" />
            <div className="space-y-6 px-5 py-5">
              <Activity events={events} memberNames={memberNames} />
              <CommentForm action={addComment.bind(null, orgId, workOrder.id)} />
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="p-5">
            <WorkOrderFields
              key={workOrder.updated_at}
              orgId={orgId}
              workOrderId={workOrder.id}
              values={{
                status: workOrder.status,
                priority: workOrder.priority,
                assignee_id: workOrder.assignee_id,
                customer_id: workOrder.customer_id,
                due_date: workOrder.due_date,
              }}
              members={members.map((m) => ({ id: m.userId, name: m.name }))}
              customers={customers}
            />
          </Card>
          <dl className="space-y-2 px-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-stone-500">Created</dt>
              <dd className="text-right">
                {formatDateTime(workOrder.created_at)}
                {workOrder.created_by && (
                  <span className="block text-stone-500">by {memberNames.get(workOrder.created_by) ?? 'a former member'}</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-stone-500">Last updated</dt>
              <dd>{formatDateTime(workOrder.updated_at)}</dd>
            </div>
            {workOrder.closed_at && (
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">Closed</dt>
                <dd>{formatDateTime(workOrder.closed_at)}</dd>
              </div>
            )}
          </dl>
        </aside>
      </div>
    </>
  )
}

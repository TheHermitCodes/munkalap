import type { Metadata } from 'next'
import Link from 'next/link'
import { ActionButton } from '@/components/action-button'
import { RoleBadge } from '@/components/badges'
import { TopBar } from '@/components/top-bar'
import { Card, CardHeader, EmptyState, PageHeader } from '@/components/ui'
import { requireUser } from '@/lib/auth'
import { getMyOrganizations, getMyPendingInvitations } from '@/lib/data'
import { acceptInvitation } from './actions'
import { CreateOrgForm } from './create-org-form'

export const metadata: Metadata = { title: 'Your organizations' }

export default async function OrgsPage() {
  const user = await requireUser()
  const [memberships, invitations] = await Promise.all([getMyOrganizations(), getMyPendingInvitations()])

  return (
    <div className="min-h-dvh">
      <TopBar email={user.email} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <PageHeader title="Your organizations" description="Each organization has its own work orders, customers and team." />

        {invitations.length > 0 && (
          <Card className="border-emerald-200">
            <CardHeader title="Invitations" description="People have invited you to join their organizations." />
            <ul className="divide-y divide-stone-100">
              {invitations.map((invitation) => (
                <li key={invitation.token} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="font-medium">{invitation.org_name}</p>
                    <p className="text-sm text-stone-500">
                      {invitation.invited_by ? `${invitation.invited_by} invited you` : 'You were invited'} as{' '}
                      {invitation.role === 'owner' ? 'an owner' : 'a member'}
                    </p>
                  </div>
                  <ActionButton action={acceptInvitation.bind(null, invitation.token)} variant="primary" pendingLabel="Joining…">
                    Accept
                  </ActionButton>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card>
          {memberships.length === 0 ? (
            <EmptyState title="You're not in any organization yet">
              Create one below, or ask a colleague to invite you using <strong>{user.email}</strong>.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-stone-100">
              {memberships.map(({ organization, role }) => (
                <li key={organization.id}>
                  <Link
                    href={`/o/${organization.id}/work-orders`}
                    className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-stone-50"
                  >
                    <span className="font-medium">{organization.name}</span>
                    <RoleBadge role={role} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Start a new organization" description="You'll be its owner and can invite your team." />
          <div className="px-5 py-4">
            <CreateOrgForm />
          </div>
        </Card>
      </main>
    </div>
  )
}

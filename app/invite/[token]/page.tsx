import type { Metadata } from 'next'
import { acceptInvitation } from '@/app/orgs/actions'
import { ActionButton } from '@/components/action-button'
import { TopBar } from '@/components/top-bar'
import { ButtonLink, Card } from '@/components/ui'
import { requireUser } from '@/lib/auth'
import { getMyPendingInvitations } from '@/lib/data'

export const metadata: Metadata = { title: 'Invitation' }

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const user = await requireUser()
  // Only invitations addressed to this user's (confirmed) email come back, so
  // a link opened in the wrong account simply isn't found.
  const invitation = (await getMyPendingInvitations()).find((i) => i.token === token)

  return (
    <div className="min-h-dvh">
      <TopBar email={user.email} />
      <main className="mx-auto max-w-md px-4 py-16">
        <Card className="p-6 text-center">
          {invitation ? (
            <>
              <p className="text-sm text-stone-500">
                {invitation.invited_by ? `${invitation.invited_by} invited you to join` : "You've been invited to join"}
              </p>
              <h1 className="mt-1 text-xl font-semibold">{invitation.org_name}</h1>
              <p className="mt-1 text-sm text-stone-500">as {invitation.role === 'owner' ? 'an owner' : 'a member'}</p>
              <div className="mt-6 flex justify-center gap-2">
                <ButtonLink href="/orgs" variant="ghost">
                  Not now
                </ButtonLink>
                <ActionButton action={acceptInvitation.bind(null, token)} variant="primary" size="md" pendingLabel="Joining…">
                  Accept invitation
                </ActionButton>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold">This invitation isn&apos;t available</h1>
              <p className="mt-2 text-sm text-stone-500">
                It may have expired or already been used, or it was sent to a different address than{' '}
                <strong className="text-stone-700">{user.email}</strong>. Ask whoever invited you to send a new one.
              </p>
              <ButtonLink href="/orgs" className="mt-6">
                Go to your organizations
              </ButtonLink>
            </>
          )}
        </Card>
      </main>
    </div>
  )
}

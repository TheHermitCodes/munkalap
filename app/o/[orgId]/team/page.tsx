import type { Metadata } from 'next'
import { ActionButton } from '@/components/action-button'
import { RoleBadge } from '@/components/badges'
import { CopyLinkButton } from '@/components/copy-button'
import { InviteForm } from '@/components/team/invite-form'
import { RoleSelect } from '@/components/team/role-select'
import { Card, CardHeader, PageHeader } from '@/components/ui'
import { getInvitations, getMembers, getOrgContext } from '@/lib/data'
import { formatDate } from '@/lib/format'
import { inviteMember, leaveOrganization, removeMember, revokeInvitation } from './actions'

export const metadata: Metadata = { title: 'Team' }

export default async function TeamPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const { org, user, isOwner } = await getOrgContext(orgId)
  // Members can't read invitations (RLS would return nothing anyway); skip the query.
  const [members, invitations] = await Promise.all([getMembers(orgId), isOwner ? getInvitations(orgId) : []])

  return (
    <>
      <PageHeader
        title="Team"
        description={org.name}
        actions={
          <ActionButton
            action={leaveOrganization.bind(null, orgId)}
            confirm={`Leave ${org.name}? You'll need a new invitation to come back.`}
            size="md"
            pendingLabel="Leaving…"
          >
            Leave organization
          </ActionButton>
        }
      />
      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Members"
            description="Owners manage the team and can delete work orders and customers. Members do everything else."
          />
          <ul className="divide-y divide-stone-100">
            {members.map((member) => {
              const isMe = member.userId === user.id
              return (
                <li key={member.userId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {member.name}
                      {isMe && <span className="ml-2 text-sm font-normal text-stone-500">(you)</span>}
                    </p>
                    <p className="truncate text-sm text-stone-500">
                      {member.email} · joined {formatDate(member.joinedAt.slice(0, 10))}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    {isOwner ? (
                      <RoleSelect orgId={orgId} userId={member.userId} role={member.role} label={member.name} />
                    ) : (
                      <RoleBadge role={member.role} />
                    )}
                    {isOwner && !isMe && (
                      <ActionButton
                        action={removeMember.bind(null, orgId, member.userId)}
                        variant="ghost"
                        confirm={`Remove ${member.name} from ${org.name}? Their work orders will become unassigned.`}
                        pendingLabel="Removing…"
                      >
                        Remove
                      </ActionButton>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>

        {isOwner && (
          <Card>
            <CardHeader title="Invite people" description="They'll join when they sign in with this email address." />
            <div className="space-y-4 px-5 py-4">
              <InviteForm action={inviteMember.bind(null, orgId)} />
              {invitations.length > 0 && (
                <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
                  {invitations.map((invitation) => {
                    const expired = new Date(invitation.expires_at) <= new Date()
                    return (
                      <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{invitation.email}</p>
                          <p className="text-xs text-stone-500">
                            {invitation.role === 'owner' ? 'Owner' : 'Member'} ·{' '}
                            {expired ? (
                              <span className="text-red-700">expired</span>
                            ) : (
                              `expires ${formatDate(invitation.expires_at.slice(0, 10))}`
                            )}
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          {!expired && <CopyLinkButton path={`/invite/${invitation.token}`} />}
                          <ActionButton
                            action={revokeInvitation.bind(null, orgId, invitation.id)}
                            variant="ghost"
                            pendingLabel="Revoking…"
                          >
                            {expired ? 'Remove' : 'Revoke'}
                          </ActionButton>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </Card>
        )}
      </div>
    </>
  )
}

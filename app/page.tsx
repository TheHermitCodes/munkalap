import { redirect } from 'next/navigation'
import { getMyOrganizations, getMyPendingInvitations } from '@/lib/data'

// Most people belong to exactly one organization: take them straight there.
export default async function Home() {
  const [orgs, invitations] = await Promise.all([getMyOrganizations(), getMyPendingInvitations()])
  const [only] = orgs
  if (orgs.length === 1 && only && invitations.length === 0) {
    redirect(`/o/${only.organization.id}/work-orders`)
  }
  redirect('/orgs')
}

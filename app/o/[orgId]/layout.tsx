import type { ReactNode } from 'react'
import { signOut } from '@/app/actions'
import { Logo } from '@/components/logo'
import { OrgNav, OrgSwitcher } from '@/components/org-nav'
import { Button } from '@/components/ui'
import { getMyOrganizations, getOrgContext } from '@/lib/data'

type Props = { children: ReactNode; params: Promise<{ orgId: string }> }

export default async function OrgLayout({ children, params }: Props) {
  const { orgId } = await params
  // 404s unless the user is a member. Pages call this again (it's cached per
  // request) because a layout doesn't re-run on every client navigation.
  const { user } = await getOrgContext(orgId)
  const memberships = await getMyOrganizations()

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="border-b border-stone-200 bg-white md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:border-r md:border-b-0">
        <div className="flex items-center justify-between gap-3 px-4 pt-4 md:block md:space-y-4">
          <Logo href="/orgs" />
          <div className="min-w-0 flex-1 md:flex-none">
            <OrgSwitcher currentOrgId={orgId} orgs={memberships.map((m) => m.organization)} />
          </div>
        </div>
        <div className="px-3 py-3 md:flex-1 md:py-4">
          <OrgNav orgId={orgId} />
        </div>
        <div className="hidden border-t border-stone-200 px-4 py-4 md:block">
          <p className="truncate text-sm text-stone-600" title={user.email ?? undefined}>
            {user.email}
          </p>
          <form action={signOut} className="mt-2">
            <Button type="submit" variant="ghost" size="sm" className="-ml-3">
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-6 md:px-10 md:py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  )
}

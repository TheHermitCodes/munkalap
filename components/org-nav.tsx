'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/components/ui'

export function OrgNav({ orgId }: { orgId: string }) {
  const pathname = usePathname()
  const links = [
    { href: `/o/${orgId}/work-orders`, label: 'Work orders' },
    { href: `/o/${orgId}/customers`, label: 'Customers' },
    { href: `/o/${orgId}/team`, label: 'Team' },
  ]

  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto md:flex-col">
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
              active ? 'bg-stone-200/70 text-stone-900' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function OrgSwitcher({ currentOrgId, orgs }: { currentOrgId: string; orgs: { id: string; name: string }[] }) {
  const router = useRouter()
  return (
    <>
      <label htmlFor="org-switcher" className="sr-only">
        Organization
      </label>
      <select
        id="org-switcher"
        value={currentOrgId}
        onChange={(event) => router.push(event.target.value === 'all' ? '/orgs' : `/o/${event.target.value}/work-orders`)}
        className="w-full truncate rounded-lg border border-stone-300 bg-white py-1.5 pr-8 pl-3 text-sm font-medium shadow-xs focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none"
      >
        {orgs.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
        <option value="all">All organizations…</option>
      </select>
    </>
  )
}

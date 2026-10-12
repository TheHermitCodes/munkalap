import { signOut } from '@/app/actions'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui'

/** Header for pages outside an organization (org picker, invitations). */
export function TopBar({ email }: { email: string | null }) {
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4">
        <Logo href="/orgs" />
        <div className="flex min-w-0 items-center gap-3">
          {email && <span className="truncate text-sm text-stone-500">{email}</span>}
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}

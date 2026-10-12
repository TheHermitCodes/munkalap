import { Logo } from '@/components/logo'
import { ButtonLink } from '@/components/ui'

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="text-center">
        <Logo />
        <h1 className="mt-8 text-xl font-semibold">Not found</h1>
        <p className="mt-2 max-w-sm text-sm text-stone-500">
          This page doesn&apos;t exist, or it belongs to an organization you&apos;re not a member of.
        </p>
        <ButtonLink href="/orgs" className="mt-6">
          Back to your organizations
        </ButtonLink>
      </div>
    </main>
  )
}

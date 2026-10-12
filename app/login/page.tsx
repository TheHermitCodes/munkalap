import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Logo } from '@/components/logo'
import { Alert, Card } from '@/components/ui'
import { getCurrentUser } from '@/lib/auth'
import { safeNextPath } from '@/lib/safe-redirect'
import { AuthForm } from './auth-form'

type Props = { searchParams: Promise<{ next?: string; mode?: string; error?: string }> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { mode } = await searchParams
  return { title: mode === 'sign-up' ? 'Create account' : 'Sign in' }
}

export default async function LoginPage({ searchParams }: Props) {
  const { next, mode, error } = await searchParams
  const nextPath = safeNextPath(next, '/')
  if (await getCurrentUser()) redirect(nextPath)

  const isSignUp = mode === 'sign-up'

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo href="/login" />
          <h1 className="mt-6 text-xl font-semibold tracking-tight">
            {isSignUp ? 'Create your account' : 'Sign in to your workspace'}
          </h1>
          <p className="mt-1 text-sm text-stone-500">Work orders for small service businesses.</p>
        </div>
        <Card className="p-6">
          {error === 'confirmation' && (
            <div className="mb-4">
              <Alert>That confirmation link is invalid or has expired. Try signing in, or sign up again.</Alert>
            </div>
          )}
          <AuthForm key={isSignUp ? 'sign-up' : 'sign-in'} mode={isSignUp ? 'sign-up' : 'sign-in'} next={nextPath} />
        </Card>
        {process.env.NODE_ENV === 'development' && (
          <p className="mt-6 text-center text-xs text-stone-500">
            Local demo: <span className="font-mono">anna@demo.test</span>, <span className="font-mono">bence@demo.test</span>{' '}
            or <span className="font-mono">dora@demo.test</span> / <span className="font-mono">password123</span>
          </p>
        )}
      </div>
    </main>
  )
}

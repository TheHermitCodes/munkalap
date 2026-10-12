'use client'

import Link from 'next/link'
import { FormStatus } from '@/components/form-status'
import { SubmitButton } from '@/components/submit-button'
import { Field, Input } from '@/components/ui'
import { useFormAction } from '@/components/use-form-action'
import { signIn, signUp } from './actions'

export function AuthForm({ mode, next }: { mode: 'sign-in' | 'sign-up'; next: string }) {
  const isSignUp = mode === 'sign-up'
  const { state, pending, onSubmit } = useFormAction(isSignUp ? signUp : signIn)
  const switchParams = new URLSearchParams({ next, ...(isSignUp ? {} : { mode: 'sign-up' }) })

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <FormStatus state={state} />
      {isSignUp && (
        <Field label="Full name" htmlFor="full_name">
          <Input id="full_name" name="full_name" autoComplete="name" required maxLength={120} />
        </Field>
      )}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" htmlFor="password" hint={isSignUp ? 'At least 8 characters.' : undefined}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          required
          minLength={isSignUp ? 8 : undefined}
        />
      </Field>
      <SubmitButton pending={pending} pendingLabel={isSignUp ? 'Creating account…' : 'Signing in…'} className="w-full">
        {isSignUp ? 'Create account' : 'Sign in'}
      </SubmitButton>
      <p className="text-center text-sm text-stone-500">
        {isSignUp ? 'Already have an account? ' : 'New here? '}
        <Link href={`/login?${switchParams}`} className="font-medium text-emerald-700 hover:underline">
          {isSignUp ? 'Sign in' : 'Create an account'}
        </Link>
      </p>
    </form>
  )
}

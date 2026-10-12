import { Alert } from '@/components/ui'
import type { ActionState } from '@/lib/action-state'

export function FormStatus({ state }: { state: ActionState }) {
  if (state.status === 'error') return <Alert tone="error">{state.message}</Alert>
  if (state.status === 'success' && state.message) return <Alert tone="success">{state.message}</Alert>
  return null
}

/** What a Server Action hands back to the form that called it. */
export type ActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message?: string }

export const idle: ActionState = { status: 'idle' }

export function failure(message: string): ActionState {
  return { status: 'error', message }
}

export function success(message?: string): ActionState {
  return { status: 'success', message }
}

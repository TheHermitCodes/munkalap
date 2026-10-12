type ErrorLike = { code?: unknown; message?: unknown }

const GENERIC_MESSAGES: Record<string, string> = {
  '42501': "You don't have permission to do that.",
  '23505': 'That already exists.',
  '23503': 'That is still in use, or refers to something that no longer exists.',
  '23514': 'Some of the values are not valid.',
  '22P02': 'Some of the values are not valid.',
}

// Messages Postgres generates itself. Anything else raised with these codes
// comes from our own SQL functions and is written for end users.
const SYSTEM_MESSAGE_PREFIXES = ['new row violates', 'permission denied']

/**
 * Turns a Supabase/Postgres error into something safe to show a user.
 * Raw database messages can leak schema details, so they're only passed
 * through when we wrote them (RAISE in our functions) or in development.
 */
export function toUserMessage(error: unknown, overrides: Record<string, string> = {}): string {
  const { code, message } = (typeof error === 'object' && error !== null ? error : {}) as ErrorLike
  const errorCode = typeof code === 'string' ? code : undefined
  const errorMessage = typeof message === 'string' ? message : undefined

  if (errorCode && overrides[errorCode]) return overrides[errorCode]

  const isOurs =
    (errorCode === 'P0001' || errorCode === '42501') &&
    errorMessage !== undefined &&
    !SYSTEM_MESSAGE_PREFIXES.some((prefix) => errorMessage.startsWith(prefix))
  if (isOurs) return errorMessage

  if (errorCode && GENERIC_MESSAGES[errorCode]) return GENERIC_MESSAGES[errorCode]
  if (process.env.NODE_ENV === 'development' && errorMessage) return errorMessage
  return 'Something went wrong. Please try again.'
}

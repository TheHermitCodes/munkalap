/**
 * Only same-site paths are allowed as a post-login destination. Without this,
 * /login?next=https://evil.example would make the login form an open redirect.
 */
export function safeNextPath(next: unknown, fallback = '/orgs'): string {
  if (typeof next !== 'string') return fallback
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback
  return next
}

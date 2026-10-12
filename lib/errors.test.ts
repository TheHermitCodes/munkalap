import { describe, expect, it } from 'vitest'
import { toUserMessage } from './errors'

describe('toUserMessage', () => {
  it('passes through messages raised by our own SQL functions', () => {
    const error = { code: 'P0001', message: 'An organization needs at least one owner.' }
    expect(toUserMessage(error)).toBe('An organization needs at least one owner.')
  })

  it('hides raw Postgres messages', () => {
    const error = { code: '42501', message: 'new row violates row-level security policy for table "work_orders"' }
    expect(toUserMessage(error)).toBe("You don't have permission to do that.")
  })

  it('lets callers explain constraint errors in context', () => {
    const error = { code: '23503', message: 'update or delete on table "customers" violates foreign key constraint' }
    expect(toUserMessage(error, { '23503': 'This customer has work orders.' })).toBe('This customer has work orders.')
  })

  it('falls back to a generic message', () => {
    expect(toUserMessage(new Error('boom'))).toMatch(/Something went wrong/)
    expect(toUserMessage(undefined)).toMatch(/Something went wrong/)
  })
})

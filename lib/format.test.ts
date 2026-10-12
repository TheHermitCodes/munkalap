import { describe, expect, it } from 'vitest'
import { formatDate, timeAgo, todayIso } from './format'

describe('todayIso', () => {
  it('uses Budapest time, not UTC', () => {
    // 23:30 UTC on 11 Oct is already 12 Oct in Budapest (UTC+2 in October).
    expect(todayIso(new Date('2026-10-11T23:30:00Z'))).toBe('2026-10-12')
  })
})

describe('formatDate', () => {
  it('does not shift plain dates across time zones', () => {
    expect(formatDate('2026-03-01')).toBe('1 Mar 2026')
  })
})

describe('timeAgo', () => {
  const now = new Date('2026-10-12T12:00:00Z')
  it('formats relative times', () => {
    expect(timeAgo('2026-10-12T11:59:30Z', now)).toBe('just now')
    expect(timeAgo('2026-10-12T09:00:00Z', now)).toBe('3 hours ago')
    expect(timeAgo('2026-10-11T12:00:00Z', now)).toBe('yesterday')
  })
})

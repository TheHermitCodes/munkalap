import { describe, expect, it } from 'vitest'
import { escapeLike, isOverdue, parseSearch, parseWorkOrderFilters, workOrderListHref } from './work-orders'

describe('parseWorkOrderFilters', () => {
  it('defaults to open work orders for everyone', () => {
    expect(parseWorkOrderFilters({})).toEqual({ view: 'open', mine: false, q: '' })
  })

  it('ignores unknown values instead of trusting the URL', () => {
    expect(parseWorkOrderFilters({ view: 'drop table', mine: 'yes', q: ['  brakes ', 'x'] })).toEqual({
      view: 'open',
      mine: false,
      q: 'brakes',
    })
  })

  it('round-trips through the list URL', () => {
    const filters = { view: 'closed', mine: true, q: 'chain' } as const
    const href = workOrderListHref('org-1', filters)
    expect(href).toBe('/o/org-1/work-orders?view=closed&mine=1&q=chain')
    const params = Object.fromEntries(new URL(href, 'http://x').searchParams)
    expect(parseWorkOrderFilters(params)).toEqual(filters)
  })
})

describe('parseSearch', () => {
  it('treats numbers as work order numbers', () => {
    expect(parseSearch('#42')).toEqual({ number: 42 })
    expect(parseSearch(' 7 ')).toEqual({ number: 7 })
  })

  it('treats everything else as title text', () => {
    expect(parseSearch('700x28 tubes')).toEqual({ text: '700x28 tubes' })
    expect(parseSearch('   ')).toBeNull()
  })
})

describe('escapeLike', () => {
  it('escapes LIKE wildcards', () => {
    expect(escapeLike('50% off_now\\')).toBe('50\\% off\\_now\\\\')
  })
})

describe('isOverdue', () => {
  const today = '2026-10-12'
  it('flags open work orders past their due date', () => {
    expect(isOverdue('2026-10-11', 'in_progress', today)).toBe(true)
  })
  it('does not flag work due today, closed work, or work without a due date', () => {
    expect(isOverdue('2026-10-12', 'open', today)).toBe(false)
    expect(isOverdue('2026-10-01', 'done', today)).toBe(false)
    expect(isOverdue(null, 'open', today)).toBe(false)
  })
})

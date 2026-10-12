import { describe, expect, it } from 'vitest'
import { safeNextPath } from './safe-redirect'

describe('safeNextPath', () => {
  it('allows same-site paths', () => {
    expect(safeNextPath('/o/123/work-orders?view=all')).toBe('/o/123/work-orders?view=all')
  })

  it('rejects anything that could leave the site', () => {
    for (const next of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', null]) {
      expect(safeNextPath(next)).toBe('/orgs')
    }
  })
})

import { describe, expect, it } from 'vitest'
import { attachmentDisplayName, attachmentPath, sanitizeFileName, validateAttachment } from './attachments'

describe('sanitizeFileName', () => {
  it('strips Hungarian accents and unsafe characters', () => {
    expect(sanitizeFileName('számla (1).pdf')).toBe('szamla-1.pdf')
    expect(sanitizeFileName('Őrült Ügyfél fotó.JPG')).toBe('Orult-Ugyfel-foto.JPG')
  })

  it('never produces an empty or hidden name', () => {
    expect(sanitizeFileName('...')).toBe('file')
    expect(sanitizeFileName('.env')).toBe('env')
  })

  it('cannot escape the folder', () => {
    expect(sanitizeFileName('../../other-org/secret.pdf')).toBe('other-org-secret.pdf')
  })
})

describe('attachmentPath', () => {
  it('puts files under org and work order folders with a unique prefix', () => {
    const id = '0f8fad5b-d9cb-469f-a165-70867728950e'
    const path = attachmentPath('org', 'wo', 'Kép.png', id)
    expect(path).toBe(`org/wo/${id}-Kep.png`)
    expect(attachmentDisplayName(path.split('/').at(-1)!)).toBe('Kep.png')
  })
})

describe('validateAttachment', () => {
  it('rejects large files and unexpected types', () => {
    expect(validateAttachment({ size: 11 * 1024 * 1024, type: 'image/png' })).toMatch(/10 MB/)
    expect(validateAttachment({ size: 100, type: 'application/x-msdownload' })).toMatch(/Only images/)
    expect(validateAttachment({ size: 100, type: 'application/pdf' })).toBeNull()
  })
})

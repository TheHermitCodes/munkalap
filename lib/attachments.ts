export const ATTACHMENTS_BUCKET = 'attachments'

// Mirrors the bucket settings in supabase/migrations/*_storage.sql. Checking in
// the browser gives instant feedback; Storage enforces the real limits.
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const ALLOWED_ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
  'text/plain',
]

const UUID_PREFIX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i

/** {org_id}/{work_order_id}: the folder the storage policies authorize against. */
export function attachmentFolder(orgId: string, workOrderId: string): string {
  return `${orgId}/${workOrderId}`
}

/**
 * Storage keys only accept a safe subset of characters, so "számla (1).pdf"
 * becomes "szamla-1.pdf". A random prefix keeps uploads with the same name
 * from overwriting each other.
 */
export function attachmentPath(orgId: string, workOrderId: string, fileName: string, id: string): string {
  return `${attachmentFolder(orgId, workOrderId)}/${id}-${sanitizeFileName(fileName)}`
}

export function sanitizeFileName(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .slice(-100)
    .replace(/^[-.]+|-+$/g, '')
    .replace(/-\./g, '.')
  return cleaned || 'file'
}

/** The name to show for a stored object: the file name without the random prefix. */
export function attachmentDisplayName(objectName: string): string {
  return objectName.replace(UUID_PREFIX, '')
}

export function validateAttachment(file: { size: number; type: string }): string | null {
  if (file.size > MAX_ATTACHMENT_BYTES) return 'Files can be at most 10 MB.'
  if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) return 'Only images, PDFs and text files can be attached.'
  return null
}

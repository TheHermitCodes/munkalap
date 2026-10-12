'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui'
import { ALLOWED_ATTACHMENT_TYPES, ATTACHMENTS_BUCKET, attachmentPath, validateAttachment } from '@/lib/attachments'
import { createClient } from '@/lib/supabase/client'

/**
 * Uploads straight from the browser to Supabase Storage with the user's own
 * session. The file never passes through the Next.js server (no body-size
 * limits, no double bandwidth), and the storage policies decide whether the
 * path is allowed, exactly as they would for any other client.
 */
export function AttachmentUploader({ orgId, workOrderId }: { orgId: string; workOrderId: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File) {
    const problem = validateAttachment(file)
    if (problem) return setError(problem)

    setUploading(true)
    setError(null)
    const path = attachmentPath(orgId, workOrderId, file.name, crypto.randomUUID())
    const { error: uploadError } = await createClient()
      .storage.from(ATTACHMENTS_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false })
    setUploading(false)

    if (uploadError) return setError('The upload failed. Check the file and try again.')
    router.refresh()
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={ALLOWED_ATTACHMENT_TYPES.join(',')}
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void upload(file)
        }}
      />
      <Button size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? 'Uploading…' : 'Attach file'}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </div>
  )
}

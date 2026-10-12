'use client'

import { useState } from 'react'
import { Button } from '@/components/ui'

/** Copies an app-relative path as an absolute URL for the current host. */
export function CopyLinkButton({ path, label = 'Copy link' }: { path: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(new URL(path, window.location.origin).toString())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button size="sm" variant="secondary" onClick={copy}>
      {copied ? 'Copied' : label}
    </Button>
  )
}

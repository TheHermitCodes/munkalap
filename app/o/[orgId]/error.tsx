'use client'

import { Button, Card, EmptyState } from '@/components/ui'

export default function OrgError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card>
      <EmptyState title="Something went wrong loading this page" action={<Button onClick={reset}>Try again</Button>}>
        If it keeps happening, the database may be unreachable.
      </EmptyState>
    </Card>
  )
}

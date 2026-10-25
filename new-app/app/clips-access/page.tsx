import { Suspense } from 'react'
import { ClipsAccessForm } from '@/app/clips-access/clips-access-form'

export default function ClipsAccessPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading…</div>}>
      <ClipsAccessForm />
    </Suspense>
  )
}

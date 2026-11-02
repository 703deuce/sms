import { Suspense } from 'react'
import { ClipsDriveShell } from '@/components/drive/clips-drive-shell'
import ClipsDriveLoading from './loading'

export const dynamic = 'force-dynamic'

export default async function ClipsDriveLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ClipsDriveLoading />}>
      <ClipsDriveShell>{children}</ClipsDriveShell>
    </Suspense>
  )
}

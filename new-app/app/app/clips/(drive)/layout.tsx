import { ClipsDriveShell } from '@/components/drive/clips-drive-shell'

export const dynamic = 'force-dynamic'

export default async function ClipsDriveLayout({ children }: { children: React.ReactNode }) {
  return <ClipsDriveShell>{children}</ClipsDriveShell>
}

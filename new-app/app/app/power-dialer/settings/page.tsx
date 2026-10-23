import { Suspense } from 'react'
import { PowerDialerSettingsContent } from '@/components/power-dialer/settings-content'

export const metadata = { title: 'Settings · Power Dialer' }

export default function PowerDialerSettingsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading settings…</p>}>
      <PowerDialerSettingsContent />
    </Suspense>
  )
}

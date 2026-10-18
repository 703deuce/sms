import { Suspense } from 'react'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { SettingsTabs } from '@/components/settings/settings-tabs'

export const metadata = { title: 'Settings' }

export default function SettingsPage() {
  return (
    <Page>
      <PageHeader title="Settings" description="Workspace profile, team, billing and preferences." />
      <Suspense>
        <SettingsTabs />
      </Suspense>
    </Page>
  )
}

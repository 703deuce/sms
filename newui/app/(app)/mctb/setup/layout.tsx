import { Page, PageHeader } from '@/components/app/kit'
import { ButtonLink } from '@/components/app/button-link'
import { LinkTabs } from '@/components/app/link-tabs'
import { MCTB_SETUP_SECTIONS } from '@/lib/nav'

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <Page>
      <PageHeader
        title="Setup"
        meta="Last successful test: Sep 24, 4:18 PM"
        actions={<ButtonLink href="/mctb/setup/test">Run live test</ButtonLink>}
      />
      <LinkTabs tabs={MCTB_SETUP_SECTIONS} label="Setup sections" />
      {children}
    </Page>
  )
}

import { Page, PageHeader } from '@/components/app/page-primitives'
import { HelpCenter } from '@/components/help/help-center'

export const metadata = { title: 'Help' }

export default function HelpPage() {
  return (
    <Page>
      <PageHeader
        title="Help"
        description="Upload videos, edit clips, captions, layout, B-roll, music, export, and brand."
      />
      <HelpCenter />
    </Page>
  )
}

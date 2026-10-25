import { Page, PageHeader, Panel } from '@/components/app/page-primitives'

export const metadata = { title: 'New project · Clips' }

export default function NewClipProjectPage() {
  return (
    <Page>
      <PageHeader title="New project" description="Upload a source video and choose how we should clip it." />
      <Panel title="Upload & settings">
        <p className="text-sm text-muted-foreground">Upload flow ships in milestone M1–M2.</p>
      </Panel>
    </Page>
  )
}

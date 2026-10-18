import { Page, PageHeader } from '@/components/app/page-primitives'
import { AppointmentsManager } from '@/components/receptionist/appointments-manager'
import { DraftBar } from '@/components/receptionist/ai-ui'

export const metadata = { title: 'Appointments · AI Receptionist' }

export default function AppointmentsPage() {
  return (
    <Page>
      <DraftBar />
      <PageHeader title="Appointments" description="What Ava can book, on which calendars, and the rules she follows. Edits stay in your draft until you publish." />
      <AppointmentsManager />
    </Page>
  )
}

import { Page } from '@/components/app/page-primitives'
import { AutoAttendantList } from '@/components/phone/auto-attendant-list'

export const metadata = { title: 'Auto Attendant · Phone' }

export default function AutoAttendantPage() {
  return (
    <Page>
      <AutoAttendantList />
    </Page>
  )
}

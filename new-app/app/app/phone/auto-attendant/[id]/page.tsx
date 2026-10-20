import { Page } from '@/components/app/page-primitives'
import { AutoAttendantEditor } from '@/components/phone/auto-attendant-editor'

export const metadata = { title: 'Edit phone menu · Phone' }

type Props = { params: Promise<{ id: string }> }

export default async function AutoAttendantEditPage({ params }: Props) {
  const { id } = await params
  return (
    <Page>
      <AutoAttendantEditor menuId={id} />
    </Page>
  )
}

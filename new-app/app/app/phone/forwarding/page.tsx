import { Page } from '@/components/app/page-primitives'
import { CallForwardingWorkspace } from '@/components/phone/call-forwarding-workspace'

export const metadata = { title: 'Call Forwarding · Phone' }

export default function CallForwardingPage() {
  return (
    <Page>
      <CallForwardingWorkspace />
    </Page>
  )
}

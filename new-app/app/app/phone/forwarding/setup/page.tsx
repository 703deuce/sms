import { Page } from '@/components/app/page-primitives'
import { ForwardingOnboarding } from '@/components/phone/forwarding-onboarding'

export const metadata = { title: 'Set up business line · Phone' }

export default function ForwardingSetupPage() {
  return (
    <Page>
      <ForwardingOnboarding />
    </Page>
  )
}

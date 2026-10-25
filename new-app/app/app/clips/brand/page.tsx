import { Page, PageHeader, EmptyState } from '@/components/app/page-primitives'
import { Palette } from 'lucide-react'

export const metadata = { title: 'Brand template · Clips' }

export default function ClipsBrandPage() {
  return (
    <Page>
      <PageHeader title="Brand template" description="Logo, fonts and default caption style for new projects." />
      <EmptyState icon={Palette} title="No brand template yet" description="Set your logo and caption defaults once, then apply them to every new project." />
    </Page>
  )
}

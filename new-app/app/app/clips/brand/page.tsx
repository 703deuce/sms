import { Page, PageHeader } from '@/components/app/page-primitives'
import { BrandEditor } from '@/app/app/clips/brand/brand-editor'

export const metadata = { title: 'Brand template · Clips' }

export default function ClipsBrandPage() {
  return (
    <Page>
      <PageHeader title="Brand template" description="Logo, fonts and default caption style for new projects." />
      <BrandEditor />
    </Page>
  )
}

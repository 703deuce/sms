import { Palette } from 'lucide-react'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { BrandEditor } from '@/app/app/clips/brand/brand-editor'

export const metadata = { title: 'Brand' }

export default function ClipsBrandPage() {
  return (
    <Page>
      <PageHeader
        icon={Palette}
        iconTone="brand"
        title="Brand kit"
        description="Logo, colors, and default caption style for new projects."
      />
      <BrandEditor />
    </Page>
  )
}

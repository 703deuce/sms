import { PageContainer } from '@/components/app/page-primitives'
import { BrandEditor } from './brand-editor'

export const metadata = { title: 'Brand' }

export default async function ClipsBrandPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; id?: string }>
}) {
  const sp = await searchParams
  const initialTab = sp.id ? 'kit' : sp.tab === 'templates' ? 'templates' : 'kit'
  return (
    <PageContainer>
      <BrandEditor initialTab={initialTab} initialTemplateId={sp.id ?? null} />
    </PageContainer>
  )
}

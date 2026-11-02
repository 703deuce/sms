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
    <BrandEditor
      key={sp.id ?? sp.tab ?? 'default'}
      initialTab={initialTab}
      initialTemplateId={sp.id ?? null}
    />
  )
}

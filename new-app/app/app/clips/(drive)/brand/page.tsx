import { BrandEditor } from './brand-editor'

export const metadata = { title: 'Brand' }

export default async function ClipsBrandPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const initialTab = tab === 'templates' ? 'templates' : 'kit'
  return (
    <div className="p-4 md:p-6">
      <BrandEditor initialTab={initialTab} />
    </div>
  )
}

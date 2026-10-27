import { Palette } from 'lucide-react'
import { BrandEditor } from './brand-editor'

export const metadata = { title: 'Brand' }

export default function ClipsBrandPage() {
  return (
    <div className="p-4 md:p-6">
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <Palette className="size-5 text-brand" aria-hidden />
          <h1 className="text-xl font-semibold">Brand kit</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Logo, colors, and default caption style for new projects.
        </p>
      </header>
      <BrandEditor />
    </div>
  )
}

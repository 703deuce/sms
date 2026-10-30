'use client'

import { TemplateStage } from '@/components/clips/editor/template-stage'
import { resolveTemplateGeometryById } from '@/lib/clips/templates/geometry'
import { signalsOrDefaults } from '@/lib/clips/templates/signals'

export default function DevTemplatePreviewPage({
  searchParams,
}: {
  searchParams: { template?: string }
}) {
  if (process.env.NODE_ENV === 'production') {
    return null
  }
  const tid = searchParams.template ?? 'G4'
  const spec = resolveTemplateGeometryById(tid, signalsOrDefaults({ clipType: 'gaming' }), {
    layout: { mode: 'fit_blur', shotOverrides: [], template: { id: tid } },
    trim: { in: 0, out: 6000 },
  } as never)
  if (!spec) return <p>Unknown template</p>
  return (
    <div className="mx-auto aspect-[9/16] w-[360px] bg-black">
      <TemplateStage spec={spec} videoUrl="/clips/sample-preview.mp4" posterUrl={null} />
    </div>
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireScriptEditorPageEnabled } from '@/lib/server/clips/require-script-editor-page'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { ScreenplayEditorPageClient } from '@/components/screenwriting/screenplay-editor-page-client'
import { getActor } from '@/lib/screenwriting/server/actor'
import { getScriptForOwner } from '@/lib/screenwriting/server/scripts'
import { resolveFormatSpec } from '@/lib/screenwriting/formats/resolve-spec'
import { FileText } from 'lucide-react'
import type { JSONContent } from '@tiptap/core'

export const dynamic = 'force-dynamic'

export default async function ScreenplayEditorPage({ params }: { params: Promise<{ scriptId: string }> }) {
  requireScriptEditorPageEnabled()
  const { scriptId } = await params
  const actor = getActor()
  const script = await getScriptForOwner(scriptId, actor.id)
  if (!script) notFound()
  const formatSpec = resolveFormatSpec(script.formatSpec, script.templateKey)
  const pmJson = (script.pmJson ?? { type: 'doc', content: [] }) as JSONContent
  const editorMeta = (script.editorMeta ?? {}) as Record<string, unknown>

  return (
    <Page className="max-w-6xl">
      <PageHeader
        icon={FileText}
        title={script.title}
        description={script.project.title}
        meta={
          <Link href="/app/sw" className="text-sm text-primary hover:underline">
            ← Projects
          </Link>
        }
      />
      <ScreenplayEditorPageClient
        scriptId={script.id}
        scriptTitle={script.title}
        formatSpec={formatSpec}
        initialDoc={pmJson}
        initialMeta={editorMeta}
      />
    </Page>
  )
}

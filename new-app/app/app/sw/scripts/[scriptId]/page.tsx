import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { ScreenplayWorkspace } from '@/components/screenwriting/screenplay-workspace'
import { getActor } from '@/lib/screenwriting/server/actor'
import { getScriptForOwner } from '@/lib/screenwriting/server/scripts'
import type { FormatSpec } from '@/lib/screenwriting/formats/types'
import { FileText } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ScreenplayEditorPage({ params }: { params: Promise<{ scriptId: string }> }) {
  const { scriptId } = await params
  const actor = getActor()
  const script = await getScriptForOwner(scriptId, actor.id)
  if (!script) notFound()
  const formatSpec = script.formatSpec as FormatSpec
  const pmJson = (script.pmJson ?? { type: 'doc', content: [] }) as import('@tiptap/core').JSONContent
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
      <ScreenplayWorkspace
        scriptId={script.id}
        scriptTitle={script.title}
        formatSpec={formatSpec}
        initialDoc={pmJson as import('@tiptap/core').JSONContent}
        initialMeta={editorMeta}
      />
    </Page>
  )
}

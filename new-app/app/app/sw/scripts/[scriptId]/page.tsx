import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Page, PageHeader } from '@/components/app/page-primitives'
import dynamic from 'next/dynamic'

const ScreenplayWorkspace = dynamic(
  () => import('@/components/screenwriting/screenplay-workspace').then((m) => m.ScreenplayWorkspace),
  { ssr: false, loading: () => <div className="h-[60vh] animate-pulse rounded-lg bg-muted" /> },
)
import { getActor } from '@/lib/screenwriting/server/actor'
import { getScriptForOwner } from '@/lib/screenwriting/server/scripts'
import { resolveFormatSpec } from '@/lib/screenwriting/formats/resolve-spec'
import { FileText } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ScreenplayEditorPage({ params }: { params: Promise<{ scriptId: string }> }) {
  const { scriptId } = await params
  const actor = getActor()
  const script = await getScriptForOwner(scriptId, actor.id)
  if (!script) notFound()
  const formatSpec = resolveFormatSpec(script.formatSpec, script.templateKey)
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

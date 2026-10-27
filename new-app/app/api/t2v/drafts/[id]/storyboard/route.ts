import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { runStoryboardMatch } from '@/lib/server/t2v/routes/storyboard-match'
import { t2vFeatureDisabledResponse } from '@/lib/server/t2v/t2v-api-guard'

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  try {
    const { id } = await params
    const workspaceId = await resolveWorkspaceId()
    const data = await runStoryboardMatch(workspaceId, id)
    return NextResponse.json({ data })
  } catch (err) {
    return jsonError(err, 400)
  }
}

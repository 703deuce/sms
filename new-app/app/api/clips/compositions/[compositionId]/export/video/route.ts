import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { enqueueCompositionExport, type ScriptExportSettings } from '@/lib/server/clips/composition-export'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function POST(request: Request, ctx: { params: Promise<{ compositionId: string }> }) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const { compositionId } = await ctx.params
    const body = (await request.json()) as Partial<ScriptExportSettings>
    const kind = body.exportKind ?? 'video'
    const settings: ScriptExportSettings = {
      exportKind: kind,
      resolution: body.resolution === '720p' || body.resolution === '4k' ? body.resolution : '1080p',
      quality: body.quality ?? 'recommended',
      burnCaptions: body.burnCaptions ?? true,
      includeSubtitleTrack: body.includeSubtitleTrack ?? false,
      includeMarkersAsChapters: body.includeMarkersAsChapters ?? true,
      audioFormat: body.audioFormat === 'mp3' ? 'mp3' : 'wav',
    }
    const result = await enqueueCompositionExport(workspaceId, compositionId, settings)
    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(result)
  } catch (err) {
    return jsonError(err, 500)
  }
}

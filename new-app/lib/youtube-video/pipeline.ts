import { withAutoContentDetection } from '@/lib/clips/content-detection'
import type { YtPlanArgs, YtProgress } from '@/lib/youtube-video/pipeline/yt-types'
import { defaultClipSettings } from '@/lib/clips/settings'
import { storyCutsInEditorialOrder } from '@/lib/youtube-video/assemble'
import { resultStoryFields } from '@/lib/youtube-video/chapters'
import { estimateYoutubeVideoCredits } from '@/lib/youtube-video/credits'
import { YoutubeVideoError } from '@/lib/youtube-video/errors'
import { importUrlAsUpload, type YoutubeVideoImporter } from '@/lib/youtube-video/import-source'
import { cutsFromOption, proposeOptionsFromPacked } from '@/lib/youtube-video/story-options'
import { packTranscripts } from '@/lib/youtube-video/transcript-packer'
import type {
  YoutubeVideoCreateInput,
  YoutubeVideoIngestedSource,
  YoutubeVideoOption,
  YoutubeVideoResult,
  YoutubeVideoSource,
} from '@/lib/youtube-video/types'

export type LoadReadySource = (workspaceId: string, projectId: string) => Promise<YoutubeVideoIngestedSource>

export type WriteYoutubeClip = (input: {
  workspaceId: string
  createdById: string | null
  runId: string
  option: YoutubeVideoOption
  sources: YoutubeVideoIngestedSource[]
}) => Promise<{ projectId: string; clipId: string; durationMs: number; renderId?: string }>

export type YoutubeVideoPipelineDeps = {
  importer: YoutubeVideoImporter
  loadReadySource: LoadReadySource
  writeClip?: WriteYoutubeClip
  proposeOptions?: (sources: YoutubeVideoIngestedSource[]) => YoutubeVideoOption[]
  /** Optional YouTube-owned long-form implementation; legacy callers unchanged. */
  planLongForm?: (args: YtPlanArgs) => Promise<YtProgress>
}

export type PreparedYoutubeVideo = {
  ingested: YoutubeVideoIngestedSource[]
  options: YoutubeVideoOption[]
  creditsEstimated: number
}

/** After ingest, upload and URL sources are the same list of ready projects. */
export async function ingestSources(
  workspaceId: string,
  sources: YoutubeVideoSource[],
  deps: Pick<YoutubeVideoPipelineDeps, 'importer' | 'loadReadySource'>,
): Promise<YoutubeVideoIngestedSource[]> {
  // Content detection is applied on import/project settings (read-only helper).
  withAutoContentDetection(defaultClipSettings())
  const ingested: YoutubeVideoIngestedSource[] = []
  for (const [index, source] of sources.entries()) {
    let projectId = source.kind === 'upload' ? source.projectId : ''
    if (source.kind === 'url') {
      const imported = await importUrlAsUpload(workspaceId, source.url, deps.importer)
      projectId = imported.projectId
    }
    try {
      const ready = await deps.loadReadySource(workspaceId, projectId)
      ingested.push({ ...ready, sourceId: ready.sourceId || `source_${index}` })
    } catch (err) {
      // Only a typed source_not_ready is a temporary wait; do not hide errors.
      if (err instanceof YoutubeVideoError) throw err
      throw new YoutubeVideoError('source_load_failed', 'Unable to load the source video.', 500)
    }
  }
  return ingested
}

export function planOptions(ingested: YoutubeVideoIngestedSource[], propose = proposeOptionsFromPacked): YoutubeVideoOption[] {
  const packed = packTranscripts(ingested)
  const options = propose(packed)
  if (!options.length) throw new YoutubeVideoError('no_story', 'Footage did not support a truthful long-form story', 400)
  return options
}

export async function prepareYoutubeVideoRun(
  workspaceId: string,
  input: YoutubeVideoCreateInput,
  deps: Pick<YoutubeVideoPipelineDeps, 'importer' | 'loadReadySource' | 'proposeOptions'>,
): Promise<PreparedYoutubeVideo> {
  const ingested = await ingestSources(workspaceId, input.sources, deps)
  return prepareFromReadyYoutubeSources(ingested, deps.proposeOptions)
}

/** Planning after all source projects have finished transcribing. */
export function prepareFromReadyYoutubeSources(
  ingested: YoutubeVideoIngestedSource[],
  proposeOptions?: YoutubeVideoPipelineDeps['proposeOptions'],
): PreparedYoutubeVideo {
  const creditsEstimated = estimateYoutubeVideoCredits(
    ingested.reduce((sum, source) => sum + source.durationMs, 0),
    ingested.length,
  )
  const options = proposeOptions ? proposeOptions(ingested) : planOptions(ingested)
  if (!options.length) throw new YoutubeVideoError('no_story', 'Footage did not support a truthful long-form story', 400)
  return { ingested, options, creditsEstimated }
}

export function assembleChosenOption(
  option: YoutubeVideoOption,
  clip: { projectId: string; clipId: string; durationMs?: number; renderId?: string },
  media?: { playbackUrl?: string | null; thumbnailUrl?: string | null; downloadUrl?: string | null },
): YoutubeVideoResult {
  const cuts = storyCutsInEditorialOrder(cutsFromOption(option))
  const story = resultStoryFields(option, cuts)
  const durationMs = clip.durationMs ?? story.durationMs
  return {
    clipId: clip.clipId,
    projectId: clip.projectId,
    renderId: clip.renderId ?? null,
    editorUrl: `/app/clips/${clip.projectId}/edit/${clip.clipId}?layoutView=script`,
    durationMs,
    durationSeconds: Math.round(durationMs / 1000),
    playbackUrl: media?.playbackUrl ?? null,
    thumbnailUrl: media?.thumbnailUrl ?? null,
    downloadUrl: media?.downloadUrl ?? null,
    plan: story.plan,
    chapters: story.chapters,
    chapterText: story.chapterText,
  }
}

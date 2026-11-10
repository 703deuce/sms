import { YoutubeVideoError } from '@/lib/youtube-video/errors'

export type ImportedProject = { projectId: string }

export type YoutubeVideoImporter = (input: { workspaceId: string; url: string }) => Promise<ImportedProject>

/**
 * Thin wrapper around the existing streamer import. Do not change import code.
 * Tests inject a mock; never download a live Twitch/Kick URL in tests.
 */
export async function importUrlAsUpload(
  workspaceId: string,
  url: string,
  importer: YoutubeVideoImporter,
): Promise<ImportedProject> {
  try {
    return await importer({ workspaceId, url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'import failed'
    throw new YoutubeVideoError('import_failed', message, 400)
  }
}

export async function defaultStreamerImporter(input: { workspaceId: string; url: string }): Promise<ImportedProject> {
  const { createStreamerImport } = await import('@/lib/server/streamer/imports')
  const created = await createStreamerImport(input.workspaceId, { url: input.url, attest: true })
  return { projectId: created.projectId }
}

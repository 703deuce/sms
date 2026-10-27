import 'server-only'
import { createId } from '@/lib/supabase/id'
import { clipProjectSettingsSchema, defaultClipSettings } from '@/lib/clips/settings'
import { getPrisma } from '@/lib/server/db'
import { projectWordsKey } from '@/lib/storage'

/** Placeholder clip project before recording media exists (upload filled on take import). */
export async function createRecordingDraftClipProject(workspaceId: string, title = 'Recording') {
  const prisma = getPrisma()
  const projectId = createId('proj')
  const settings = clipProjectSettingsSchema.parse(defaultClipSettings())
  await prisma.clipProject.create({
    data: {
      id: projectId,
      workspaceId,
      title,
      settings: JSON.parse(JSON.stringify(settings)),
      status: 'DRAFT',
      stage: 'recording',
      transcriptKey: projectWordsKey(workspaceId, projectId),
    },
  })
  return projectId
}

import type { Prisma } from '@prisma/client'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'

export type ScriptEditorUserPreferences = {
  automaticVolumeLevels?: boolean
  showVolumeDb?: boolean
  useRoomToneOnGaps?: boolean
  applySmartTransitions?: boolean
  defaultCaptionStyleId?: string
  defaultClipAspect?: '9:16' | '1:1' | '4:5' | '16:9'
  limitPreview1080?: boolean
  theme?: 'dark' | 'light' | 'system'
  showWordlessMediaInScript?: boolean
  showRulerMarkers?: boolean
  showRulerComments?: boolean
}

const DEFAULTS: ScriptEditorUserPreferences = {
  automaticVolumeLevels: true,
  showVolumeDb: false,
  useRoomToneOnGaps: true,
  applySmartTransitions: true,
  defaultCaptionStyleId: 'bold_pop',
  defaultClipAspect: '9:16',
  limitPreview1080: true,
  theme: 'dark',
  showWordlessMediaInScript: false,
  showRulerMarkers: true,
  showRulerComments: true,
}

export function mergeEditorPrefs(raw: unknown): ScriptEditorUserPreferences {
  const base = { ...DEFAULTS }
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  return {
    ...base,
    automaticVolumeLevels: typeof o.automaticVolumeLevels === 'boolean' ? o.automaticVolumeLevels : base.automaticVolumeLevels,
    showVolumeDb: typeof o.showVolumeDb === 'boolean' ? o.showVolumeDb : base.showVolumeDb,
    useRoomToneOnGaps: typeof o.useRoomToneOnGaps === 'boolean' ? o.useRoomToneOnGaps : base.useRoomToneOnGaps,
    applySmartTransitions:
      typeof o.applySmartTransitions === 'boolean' ? o.applySmartTransitions : base.applySmartTransitions,
    defaultCaptionStyleId:
      typeof o.defaultCaptionStyleId === 'string' ? o.defaultCaptionStyleId : base.defaultCaptionStyleId,
    defaultClipAspect:
      o.defaultClipAspect === '9:16' || o.defaultClipAspect === '1:1' || o.defaultClipAspect === '4:5' || o.defaultClipAspect === '16:9'
        ? o.defaultClipAspect
        : base.defaultClipAspect,
    limitPreview1080: typeof o.limitPreview1080 === 'boolean' ? o.limitPreview1080 : base.limitPreview1080,
    theme:
      o.theme === 'dark' || o.theme === 'light' || o.theme === 'system' ? o.theme : base.theme,
    showWordlessMediaInScript:
      typeof o.showWordlessMediaInScript === 'boolean' ? o.showWordlessMediaInScript : base.showWordlessMediaInScript,
    showRulerMarkers: typeof o.showRulerMarkers === 'boolean' ? o.showRulerMarkers : base.showRulerMarkers,
    showRulerComments: typeof o.showRulerComments === 'boolean' ? o.showRulerComments : base.showRulerComments,
  }
}

export async function getEditorPreferences(workspaceId: string, userId: string) {
  const prisma = getPrisma()
  const row = await prisma.scriptEditorUserPrefs.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  })
  return mergeEditorPrefs(row?.prefs)
}

export async function saveEditorPreferences(
  workspaceId: string,
  userId: string,
  patch: Partial<ScriptEditorUserPreferences>,
) {
  const prisma = getPrisma()
  const current = await getEditorPreferences(workspaceId, userId)
  const next = { ...current, ...patch }
  await prisma.scriptEditorUserPrefs.upsert({
    where: { workspaceId_userId: { workspaceId, userId } },
    create: {
      id: createId('sepr'),
      workspaceId,
      userId,
      prefs: next as Prisma.InputJsonValue,
    },
    update: {
      prefs: next as Prisma.InputJsonValue,
      updatedAt: new Date(),
    },
  })
  return next
}

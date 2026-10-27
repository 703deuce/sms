/**
 * Forward-compatible source / take model for script editor compositions.
 * Upload VOD today; Descript-style recordings (screen, webcam, mic, remote guests)
 * drop in as multi-track takes without changing word ids or EDL rules.
 *
 * Milestones for recording UI/capture are TBD (owner feature map). Types only.
 */

/** Stable id namespace for transcript words (unchanged when take replaces upload). */
export type SourceMediaRef =
  | { kind: 'upload'; uploadId: string }
  | { kind: 'import'; projectId: string }
  | { kind: 'take'; takeId: string }

export type ScriptMediaTrackRole = 'program' | 'screen' | 'camera' | 'mic' | 'mixed' | 'aux'

export type ScriptMediaTrack = {
  id: string
  takeId: string
  role: ScriptMediaTrackRole
  /** Local or remote participant (guest tracks share a take, separate mic/camera). */
  participantId?: string
  label?: string
  storageKey: string
  proxyHlsKey?: string | null
  audioPeaksKey?: string | null
  /** Offset from take timeline origin (ms). */
  syncOffsetMs?: number
  durationMs: number
}

/**
 * One recorded or imported capture session. A composition references exactly one
 * primary take for transcript + EDL; optional replacement swaps tracks in place.
 */
export type ScriptRecordingTake = {
  id: string
  projectId: string
  workspaceId: string
  /** Transcript + word ids are keyed to this ref (see resolveSourceMediaId). */
  sourceMediaRef: SourceMediaRef
  startedAt?: string
  durationMs: number
  tracks: ScriptMediaTrack[]
  /**
   * Track used for word timings and main preview picture (often `mixed` or `program`).
   * Multi-track preview composites screen + camera per layout; EDL times stay on this clock.
   */
  primaryTrackId: string
  transcriptKey?: string | null
  enrichedAt?: string | null
}

/** Composition-level pointer (persist on ScriptComposition JSON until Prisma migration). */
export type ScriptCompositionSource = {
  takeId: string
  primaryTrackId: string
  /** Legacy single-file upload still valid when take has one `program` track. */
  sourceMediaRef: SourceMediaRef
}

export function sourceMediaIdFromRef(ref: SourceMediaRef): string {
  switch (ref.kind) {
    case 'upload':
      return `clip_upload:${ref.uploadId}`
    case 'import':
      return `import:${ref.projectId}`
    case 'take':
      return `take:${ref.takeId}`
  }
}

/** Today: upload/import only. When takes ship, prefer take ref if present. */
export function resolveCompositionSourceMediaId(
  project: { id: string; uploadId?: string | null },
  compositionSource?: ScriptCompositionSource | null,
): string {
  if (compositionSource?.sourceMediaRef) {
    return sourceMediaIdFromRef(compositionSource.sourceMediaRef)
  }
  if (compositionSource?.takeId) return `take:${compositionSource.takeId}`
  if (project.uploadId) return `clip_upload:${project.uploadId}`
  return `import:${project.id}`
}

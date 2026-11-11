import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { moveSourceSegmentBoundary, patchSourceSegment, replaceSourceSegmentMedia, type ClipMediaSource } from '@/lib/clips/editor/sources'
import { setCutTransition } from '@/lib/clips/editor/transitions'
import { setPropertyAt } from '@/lib/clips/editor/keyframes'
import {
  compileTemplate,
  type TemplateAsset,
  type TemplateChoices,
  type TemplateCompileResult,
  type TemplateDesignV1,
  type TemplateFamilyV1,
} from '@/lib/clips/real-video-templates/sequence-contract'
import { proveEditableTimelineStructure, snapshotEditableTimelineStructure, type EditableTimelineStructureProof } from '@/lib/clips/real-video-templates/editable-timeline-proof'

const license = (id: string) => ({ id: `lic_${id}`, provenance: 'user-owned' as const, reference: `library_${id}` })
const image = (id: string): TemplateAsset => ({ id, kind: 'image', license: license(id) })
const video = (id: string, durationFrames = 180): TemplateAsset => ({ id, kind: 'video', durationFrames, license: license(id) })
const audio = (id: string, durationFrames = 900): TemplateAsset => ({ id, kind: 'audio', durationFrames, license: license(id) })

function carrier(totalFrames: number) {
  const durationMs = Math.round(totalFrames * 1000 / 30)
  const base = defaultEdits({ clipStartMs: 0, clipEndMs: durationMs })
  return {
    durationFrames: totalFrames,
    edits: { ...base, trim: { in: 0, out: durationMs }, layout: { ...base.layout, mode: 'full_frame' as const } },
  }
}
function design(family: TemplateFamilyV1, id: string): TemplateDesignV1 {
  return {
    schemaVersion: 1, designId: id, revision: 1, stylePackId: `style_${id}`,
    familyId: family.familyId, familyRevision: family.revision, musicPolicy: 'licensed-only',
  }
}

export type EditableTimelineProofCase = {
  id: 'one-photo' | 'mixed-sources' | 'birthday-30'
  family: TemplateFamilyV1
  design: TemplateDesignV1
  choices: TemplateChoices
  compiled: TemplateCompileResult
  proof: EditableTimelineStructureProof
}

function compileCase(id: EditableTimelineProofCase['id'], family: TemplateFamilyV1, choices: TemplateChoices): EditableTimelineProofCase {
  const d = design(family, `design_${id.replace(/-/g, '_')}`)
  const compiled = compileTemplate(family, d, choices, carrier(family.totalFrames))
  return { id, family, design: d, choices, compiled, proof: proveEditableTimelineStructure(family, d, choices, compiled) }
}

export function buildEditableTimelineProofCases(): EditableTimelineProofCase[] {
  const one: TemplateFamilyV1 = {
    schemaVersion: 1, familyId: 'proof_one_photo', revision: 1, title: 'One photo proof', tags: ['proof'],
    aspects: ['9:16'], fps: 30, totalFrames: 30, timingMode: 'beat',
    slots: [{ id: 'hero', ordinal: 1, role: 'hero', media: 'image', startFrame: 0, durationFrames: 30,
      fit: 'cover', sourceAudio: 'mute', transition: 'cut', motion: { from: { scale: 100 }, to: { scale: 108 }, ease: 'out' } }],
    texts: [{ id: 'title', defaultText: 'One photo', maxChars: 40, startFrame: 0, durationFrames: 30, x: 50, y: 18,
      font: 'Anton', size: 72, color: '#FFFFFF',
      animation: { in: { type: 'fade', unit: 'block', durationFrames: 3 }, out: { type: 'fade', unit: 'block', durationFrames: 3 } },
      motion: { from: { y: 4 }, to: { y: 0 }, ease: 'out' } }],
    graphics: [{ id: 'bar', type: 'rounded', startFrame: 0, durationFrames: 30, x: 50, y: 82, w: 700, h: 48, color: '#FFB020',
      animation: { in: { type: 'pop', unit: 'block', durationFrames: 3 } } }],
    beatAnchors: [0, 27],
  }
  const oneChoices: TemplateChoices = {
    instanceId: 'proof_instance_one', media: { hero: image('proof_photo_one') }, music: audio('proof_music_one', 300),
  }

  const mixed: TemplateFamilyV1 = {
    schemaVersion: 1, familyId: 'proof_mixed', revision: 1, title: 'Mixed proof', tags: ['proof'],
    aspects: ['9:16'], fps: 30, totalFrames: 90, timingMode: 'beat',
    slots: [
      { id: 'intro', ordinal: 1, role: 'hero', media: 'image', startFrame: 0, durationFrames: 30, handles: { headFrames: 0, tailFrames: 6 },
        fit: 'cover', sourceAudio: 'mute', transition: 'cut' },
      { id: 'video', ordinal: 2, role: 'support', media: 'video', startFrame: 30, durationFrames: 30, sourceInFrame: 12,
        handles: { headFrames: 9, tailFrames: 0 }, fit: 'cover', sourceAudio: 'source', speed: 1.5,
        transition: { type: 'crossfade', durationFrames: 12 }, motion: { from: { x: -4, scale: 103 }, to: { x: 3, scale: 108 }, ease: 'inOut' },
        fx: { contrast: 8, saturation: 6 } },
      { id: 'close', ordinal: 3, role: 'closing', media: 'image', startFrame: 60, durationFrames: 30,
        fit: 'contain', sourceAudio: 'mute', transition: 'cut' },
    ],
    texts: [{ id: 'headline', defaultText: 'Mixed sources', maxChars: 60, startFrame: 0, durationFrames: 90, x: 50, y: 12,
      font: 'Montserrat', size: 58, color: '#FFFFFF',
      animation: { in: { type: 'slide_up', unit: 'block', durationFrames: 6 }, out: { type: 'fade', unit: 'block', durationFrames: 6 } },
      motion: { from: { x: -3 }, to: { x: 2 }, ease: 'inOut' } }],
    graphics: [{ id: 'accent', type: 'circle', startFrame: 30, durationFrames: 30, x: 88, y: 18, w: 90, h: 90, color: '#36C5F0',
      animation: { in: { type: 'pop', unit: 'block', durationFrames: 6 } }, motion: { from: { scale: 80 }, to: { scale: 100 }, ease: 'out' } }],
    beatAnchors: [0, 30, 60, 84],
  }
  const mixedChoices: TemplateChoices = {
    instanceId: 'proof_instance_mixed',
    media: { intro: image('proof_intro'), video: video('proof_video', 180), close: image('proof_close') },
    music: audio('proof_music_mixed', 900),
  }

  const birthdaySlots: TemplateFamilyV1['slots'] = Array.from({ length: 30 }, (_, i) => ({
    id: `birthday_${i + 1}`, ordinal: i + 1, role: i === 0 ? 'hero' : i === 29 ? 'closing' : 'support',
    media: 'image', startFrame: i * 30, durationFrames: 30, fit: i % 3 === 0 ? 'contain' : 'cover',
    sourceAudio: 'mute', transition: 'cut',
    ...(i % 4 === 0 ? { motion: { from: { scale: 100 }, to: { scale: 106 }, ease: 'out' as const } } : {}),
  }))
  const birthday: TemplateFamilyV1 = {
    schemaVersion: 1, familyId: 'birthday_30', revision: 1, title: 'Birthday 30', tags: ['birthday','proof'],
    aspects: ['9:16'], fps: 30, totalFrames: 900, timingMode: 'beat', slots: birthdaySlots,
    texts: [{ id: 'birthday_title', defaultText: 'Happy Birthday!', maxChars: 80, startFrame: 0, durationFrames: 900, x: 50, y: 12,
      font: 'Poppins', size: 64, color: '#FFFFFF',
      animation: { in: { type: 'pop', unit: 'block', durationFrames: 6 }, out: { type: 'fade', unit: 'block', durationFrames: 6 } } }],
    graphics: [{ id: 'birthday_star', type: 'star', startFrame: 0, durationFrames: 900, x: 90, y: 10, w: 100, h: 100, color: '#FFD166',
      animation: { in: { type: 'pop', unit: 'block', durationFrames: 6 }, loop: { type: 'pulse', periodFrames: 30 } } }],
    beatAnchors: [...Array.from({ length: 30 }, (_, i) => i * 30), 894],
  }
  const birthdayChoices: TemplateChoices = {
    instanceId: 'proof_instance_birthday',
    media: Object.fromEntries(birthdaySlots.map((slot, i) => [slot.id, image(`birthday_photo_${i + 1}`)])),
    music: audio('birthday_music', 1800),
  }

  return [
    compileCase('one-photo', one, oneChoices),
    compileCase('mixed-sources', mixed, mixedChoices),
    compileCase('birthday-30', birthday, birthdayChoices),
  ]
}

export function buildEditedReloadProofCase(): {
  edits: ClipEditsV2
  structure: ReturnType<typeof snapshotEditableTimelineStructure>
  sourceSegmentIds: string[]
} {
  const c = buildEditableTimelineProofCases()[1]!
  const ids = c.compiled.edits.sourceSegments!.map((seg) => seg.id)
  const second = ids[1]!
  const replacementSource: ClipMediaSource = {
    id: 'replacement_source',
    ref: 'upload',
    refId: 'replacement_video',
    mediaType: 'video',
    durationMs: 10_000,
  }

  let edits = replaceSourceSegmentMedia(c.compiled.edits, second, replacementSource)
  edits = moveSourceSegmentBoundary(edits, ids[0]!, ids[1]!, 1033)
  edits = setCutTransition(edits, 1033, { type: 'wipe_left', durMs: 300 })

  const text = edits.textItems!.find((item) => item.kind !== 'shape')!
  edits = {
    ...edits,
    textItems: edits.textItems!.map((item) => item.id === text.id
      ? { ...item, text: 'Edited after publish', anim: { in: { type: 'pop' as const, unit: 'block' as const, durMs: 200 } } }
      : item),
  }
  edits = setPropertyAt(edits, `text:${text.id}`, 'x', 0, 7)
  edits = {
    ...edits,
    audio: {
      ...edits.audio!,
      music: {
        ...edits.audio!.music!,
        generationId: 'replacement_music',
        uploadId: 'replacement_music',
        volume: 0.35,
      },
    },
    sourceSegments: patchSourceSegment(
      edits.sourceSegments,
      second,
      { fx: { contrast: 22, saturation: -7 } },
      edits.sources,
    ),
    captions: { ...edits.captions, enabled: true },
    captionLines: [{ id: 'caption_all', startMs: 0, endMs: 3000, text: 'CAPTION THROUGH EVERY SLOT' }],
  }

  const normalized = normalizeEdits(edits, {
    clipStartMs: 0, clipEndMs: 3000, trimMinMs: 0, trimMaxMs: 3000,
  })
  return { edits: normalized, structure: snapshotEditableTimelineStructure(normalized), sourceSegmentIds: ids }
}

export function editableTimelineProofJson(): string {
  const editedReload = buildEditedReloadProofCase()
  return JSON.stringify({
    schema: 'transovo.real-video-template.editable-timeline-proof.v1',
    generatedFrom: 'deterministic-fixtures',
    cases: buildEditableTimelineProofCases().map(({ id, proof }) => ({ id, ...proof })),
    editedReload,
  }, null, 2)
}

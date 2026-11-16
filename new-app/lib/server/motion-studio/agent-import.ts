import 'server-only'
import { createHash } from 'node:crypto'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage, storageDriverName } from '@/lib/storage'
import { registerProjectMedia } from '@/lib/server/clips/project-media'
import type { ClipEditsV2, ClipMotionStudioExt } from '@/lib/clips/edits'
import type { ClipMediaSource, SourceSegment } from '@/lib/clips/editor/sources'
import type { BrollItem } from '@/lib/clips/broll'
import type { ClipAudioSfx } from '@/lib/clips/audio'
import type { Marker } from '@/lib/clips/editor/markers'
import type { Track } from '@/lib/clips/editor/tracks'

type Artifact = { id: string; key: string; kind: string; filename: string; mime: string; bytes: number; state: string; elementId?: string; trackId?: string }
type Element = { id: string; trackId: string; startMs: number; endMs: number; file: string; sourceInMs: number; gainDb: number; text: string; editable: Record<string, unknown>; engine?: unknown; codeRef?: unknown }
type Manifest = { elements: Element[]; chapters: Marker[]; tracks: { id: string; kind: string; label: string }[] }
type Raw = Record<string, unknown>
const obj = (v: unknown): Raw => v && typeof v === 'object' && !Array.isArray(v) ? v as Raw : {}
const txt = (v: unknown) => typeof v === 'string' ? v.trim() : ''
const idFor = (s: string) => 'msau_' + createHash('sha256').update(s).digest('hex').slice(0, 28)
const safe = (v: unknown, prefix = 'ms') => (prefix + '_' + txt(v)).replace(/[^A-Za-z0-9_-]/g,'_').slice(0,80)
const millis = (v: unknown) => Number.isSafeInteger(Number(v)) && Number(v) >= 0 ? Number(v) : NaN
const gain = (db: number) => Math.max(0, Math.min(2, Math.pow(10, db / 20)))

/** Validate the exact transovo.motion-project/1 time domain before touching editor data. */
export function parseAgentManifest(raw: unknown, durationMs: number): Manifest {
  const doc = obj(raw)
  const schema = txt(doc.schema || doc.schemaVersion)
  if (schema !== 'transovo.motion-project/1') throw new Error('Unsupported project manifest')
  if (!Array.isArray(doc.tracks)) throw new Error('Project tracks missing')
  const tracks = doc.tracks.slice(0, 64).map(v => {
    const t = obj(v)
    return { id: txt(t.id), kind: txt(t.kind), label: txt(t.label || t.name) }
  }).filter(t => /^[A-Za-z0-9_-]{1,40}$/.test(t.id))
  const seen = new Set<string>()
  const elements: Element[] = []
  const add = (v: unknown, fallbackTrack = '') => {
    const e = obj(v)
    const id = txt(e.id || e.elementId)
    const trackId = txt(e.trackId || e.track || fallbackTrack)
    const startMs = millis(e.startMs), endMs = millis(e.endMs)
    if (!id || seen.has(id) || !tracks.some(t => t.id === trackId) ||
      !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs || endMs > durationMs + 1000) return
    seen.add(id)
    const editable = obj(e.editable)
    elements.push({ id, trackId, startMs, endMs: Math.min(durationMs,endMs),
      file: txt(e.file || e.filename || e.asset), sourceInMs: Math.max(0, Number(e.sourceInMs) || 0),
      gainDb: Number(e.gainDb) || 0, text: txt(e.text || editable.text), editable,
      engine: e.engine, codeRef: e.codeRef })
  }
  if (Array.isArray(doc.elements)) doc.elements.slice(0,1000).forEach(v=>add(v))
  for (const t of (doc.tracks as unknown[]).slice(0,64)) {
    const row = obj(t)
    if (Array.isArray(row.elements)) row.elements.slice(0,500).forEach(v=>add(v,txt(row.id)))
    if (Array.isArray(row.items)) row.items.slice(0,500).forEach(v=>add(v,txt(row.id)))
  }
  if (!elements.length) throw new Error('Manifest contains no usable timeline elements')
  const chapters: Marker[] = Array.isArray(doc.chapters) ? doc.chapters.slice(0,150).flatMap((v,i) => {
    const ch = obj(v), ms = millis(ch.startMs ?? ch.ms)
    return Number.isFinite(ms) && ms < durationMs ? [{ id: safe(ch.id || i, 'ms_ch'), ms, color: 'blue' as const,
      label: txt(ch.title || ch.label).slice(0,80), chapter: true as const }] : []
  }) : []
  return { tracks, elements, chapters }
}

function resolveArtifact(e: Element, all: Artifact[]): Artifact | undefined {
  const direct = all.find(a => a.state === 'ready' && a.elementId === e.id && (!a.trackId || a.trackId === e.trackId))
  if (direct) return direct
  const filename = e.file.split('/').pop()
  return filename ? all.find(a => a.state === 'ready' && a.filename === filename) : undefined
}

/**
 * Preserve the MP4 as the initial canvas and import individually editable scene/media/audio
 * placements into the existing Compact Editor data model. Re-imports reuse stable upload IDs.
 */
export async function importAgentTimeline(args: { workspaceId: string; motionProjectId: string; clipProjectId: string;
  durationMs: number; base: ClipEditsV2; latestJobId?: string;
  /** Already-authenticated clipper agent artifacts (same signed upload contract). */
  directArtifacts?: Artifact[] }): Promise<ClipEditsV2 | null> {
  const db = getPrisma()
  let all: Artifact[]
  if (args.directArtifacts) {
    all = args.directArtifacts
  } else {
    if (!args.latestJobId) return null
    const job = await db.motionStudioAgentJob.findUnique({ where: { id: args.latestJobId },
      select: { artifacts: true, status: true, workspaceId: true, projectId: true } })
    if (!job || job.status !== 'complete' || job.workspaceId !== args.workspaceId || job.projectId !== args.motionProjectId) return null
    all = (Array.isArray(job.artifacts) ? job.artifacts : []) as Artifact[]
  }
  const projectFile = all.find(a => a.filename === 'project.json' && a.state === 'ready' && a.mime === 'application/json')
  if (!projectFile || projectFile.bytes > 8_000_000) return null
  let manifest: Manifest
  try {
    const raw = await getClipStorage().getObjectBytes(projectFile.key)
    if (raw.byteLength > 8_000_000) return null
    manifest = parseAgentManifest(JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,'')), args.durationMs)
  } catch (err) {
    console.warn('[motion-studio:manifest] fallback_to_master', { projectId: args.motionProjectId,
      error: err instanceof Error ? err.name : 'unknown' })
    return null
  }
  const media = new Map<string, { id: string; mediaType: 'video'|'audio'|'image'; filename: string }>()
  for (const asset of all) {
    if (asset.state !== 'ready') continue
    const mediaType = asset.mime.startsWith('video/') ? 'video' : asset.mime.startsWith('audio/') ? 'audio' :
      asset.mime.startsWith('image/') ? 'image' : null
    if (!mediaType || asset.kind === 'video' && asset.filename === 'video.mp4') continue
    const uploadId = idFor(asset.key)
    try {
      await db.clipUpload.upsert({ where: { id: uploadId },
        create: { id: uploadId, workspaceId: args.workspaceId, key: asset.key, filename: asset.filename,
          bytes: BigInt(asset.bytes), mime: asset.mime, kind: 'media', status: 'COMPLETE', storageDriver: storageDriverName() },
        update: {} })
      await registerProjectMedia(args.workspaceId,args.clipProjectId,{ uploadId, label: asset.filename })
      media.set(asset.id, { id: uploadId, mediaType, filename: asset.filename })
    } catch (err) {
      console.warn('[motion-studio:manifest] media_registration_skipped', { artifactId: asset.id, kind: err instanceof Error ? err.name : 'error' })
    }
  }
  const sources: ClipMediaSource[] = []
  const sourceSegments: SourceSegment[] = []
  const broll: BrollItem[] = []
  const sfx: ClipAudioSfx[] = []
  const tracks: Track[] = []
  const extTracks: ClipMotionStudioExt['tracks'] = []
  const sourceSeen = new Set<string>()
  const mapped = new Map<string,string>()
  const lane = (trackId: string): 'video'|'footage'|'text'|'audio' => {
    const t = manifest.tracks.find(v=>v.id===trackId)
    const k = (t?.kind + ' ' + t?.label + ' ' + trackId).toLowerCase()
    if (/(narration|music|sfx|sound|audio|dialog|voice|\ba[1-9]\b)/.test(k)) return 'audio'
    if (/(title|text|overlay|caption|lower.third)/.test(k)) return 'text'
    if (/(footage|insert|b.roll|\bv2\b)/.test(k)) return 'footage'
    return 'video'
  }
  const friendlyLane = (id: string): string => {
    const k = lane(id)
    const t = manifest.tracks.find(v=>v.id===id)
    const name = (t?.label || '').toLowerCase()
    if (k === 'video') return 'Scenes'
    if (k === 'footage') return 'Footage'
    if (k === 'text') return 'Titles and graphics'
    if (/narration|voice/.test(name)) return 'Narration'
    if (/music/.test(name)) return 'Music'
    if (/dialog|footage sound|natural/.test(name)) return 'Footage audio'
    return 'Sound effects'
  }
  let trackIndex = 2
  for (const t of manifest.tracks) {
    const kind = lane(t.id)
    const members: string[] = []
    for (const e of manifest.elements.filter(x=>x.trackId===t.id)) {
      const asset = resolveArtifact(e,all), file = asset ? media.get(asset.id) : undefined
      const itemId = safe(e.id, 'ms')
      mapped.set(e.id,itemId)
      if (kind === 'text' && e.text && !file && e.endMs - e.startMs >= 300) {
        members.push(itemId)
      } else if (file && kind === 'video' && file.mediaType === 'video') {
        if (!sourceSeen.has(file.id)) {
          sources.push({ id:file.id,ref:'upload',refId:file.id,mediaType:'video',label:file.filename })
          sourceSeen.add(file.id)
        }
        sourceSegments.push({ id:itemId,sourceId:file.id,startMs:e.startMs,endMs:e.endMs,inMs:e.sourceInMs,audio:'main' })
      } else if (file && (kind === 'footage' || kind === 'text') && file.mediaType !== 'audio') {
        broll.push({ id:itemId,source:'upload',uploadId:file.id, ...(file.mediaType==='image'?{still:true as const}:{}),
          startMs:e.startMs,endMs:e.endMs,inMs:e.sourceInMs,placement:'manual' })
        members.push(itemId)
      } else if (file && kind === 'audio' && file.mediaType === 'audio') {
        sfx.push({ generationId:file.id,uploadId:file.id,atMs:e.startMs,inMs:e.sourceInMs,
          durMs:e.endMs-e.startMs,volume:gain(e.gainDb),kind: /music/i.test(t.label + t.id) ? 'music' : 'audio',
          ...( /narration|voice/i.test(t.label+t.id) ? {voiceover:true}:{} ) })
        members.push(file.id)
      }
    }
    extTracks.push({ id:t.id,kind:t.kind,label:friendlyLane(t.id),items:manifest.elements.filter(x=>x.trackId===t.id).map(e=>({
      id:e.id, startMs:e.startMs,endMs:e.endMs,sourceInMs:e.sourceInMs,
      editable:e.editable, itemId:mapped.get(e.id) || null,
      engine:e.engine ?? null, codeRef:e.codeRef ?? null
    })) })
    const renderKind = kind==='footage' ? 'overlay' : kind==='text' ? 'text' : kind==='audio' ? 'audio' : null
    if (renderKind && members.length && trackIndex < 48) {
      tracks.push({ id: 'ms' + trackIndex++, kind:renderKind, name:friendlyLane(t.id), items:members })
    }
  }
  const textItems = manifest.elements.filter(e=>lane(e.trackId)==='text' && e.text && !resolveArtifact(e,all) && e.endMs-e.startMs>=300)
    .slice(0,60).map(e=>({ id:safe(e.id,'ms'),text:e.text.slice(0,200),startMs:e.startMs,endMs:e.endMs,
      x:50,y:83,style:{font:'Montserrat' as const,size:80,color:'#FFFFFF',align:'center' as const,case:'none' as const} }))
  // Import a sidecar SRT when supplied; caption edits use the editor's native
  // caption lane and can be retimed or rewritten independently of the footage.
  const captionArtifact = all.find(a => a.state === 'ready' &&
    (a.mime === 'application/x-subrip' || /\.srt$/i.test(a.filename)) && a.bytes <= 2_000_000)
  let captionLines: {id:string;text:string;startMs:number;endMs:number}[] = []
  if (captionArtifact) try {
    const content = (await getClipStorage().getObjectBytes(captionArtifact.key)).toString('utf8')
    const time = (v: string) => {
      const m = /^(\d{2}):(\d{2}):(\d{2})[,\.](\d{3})$/.exec(v.trim())
      return m ? ((Number(m[1])*3600+Number(m[2])*60+Number(m[3]))*1000+Number(m[4])) : NaN
    }
    for (const block of content.replace(/\r/g,'').split(/\n\s*\n/)) {
      const lines=block.trim().split('\n')
      const arrow=lines.findIndex(line=>line.includes('-->'))
      if (arrow<0) continue
      const [a,b]=lines[arrow]!.split('-->').map(time)
      const text=lines.slice(arrow+1).join('\n').trim()
      if (!Number.isFinite(a)||!Number.isFinite(b)||b<=a||!text||a>=args.durationMs) continue
      captionLines.push({id:'mscap_'+captionLines.length,text:text.slice(0,200),
        startMs:a,endMs:Math.min(b,args.durationMs)})
      if (captionLines.length>=2000) break
    }
  } catch { /* Missing sidecars never block production import. */ }

  const motionStudio: ClipMotionStudioExt = { v:1,projectId:args.motionProjectId,timelineVersion:1,
    durationMs:args.durationMs,fps:30,tracks:extTracks,segments:manifest.elements.filter(e=>lane(e.trackId)==='video').map(e=>({
      id:e.id,startMs:e.startMs,endMs:e.endMs,elementId:e.id
    })) }
  // Preserve the full master as the default picture/canvas. Only replace its
  // baked audio when every audio manifest element has a playable registered stem.
  // Otherwise the master mix remains authoritative (avoids silent exports).
  const audioElements = manifest.elements.filter(e=>lane(e.trackId)==='audio')
  const haveAllStems = audioElements.length > 0 && audioElements.every(e => {
    const asset = resolveArtifact(e, all)
    return asset && media.has(asset.id)
  })
  const replaceAudio = haveAllStems && sfx.length === audioElements.length
  // On a new production revision, replace only the previously imported items.
  // Preserve manual editor items, while stable element IDs map to new artifacts.
  const manualSources = (args.base.sources??[]).filter(x=>!x.id.startsWith('msau_'))
  const manualBroll = (args.base.broll??[]).filter(x=>!x.id.startsWith('ms_'))
  const manualText = (args.base.textItems??[]).filter(x=>!x.id.startsWith('ms_'))
  const manualTracks = (args.base.tracks??[]).filter(x=>!/^ms[0-9]+$/.test(x.id))
  return { ...args.base,
    ...(replaceAudio ? { audioMuteRanges: [[0,args.durationMs] as [number,number]],
      audio: { ...args.base.audio, music:null, sfx } } : {}),
    sources:[...manualSources,...sources], sourceSegments,
    broll:[...manualBroll,...broll], textItems:[...manualText,...textItems],
    tracks:[...manualTracks,...tracks],
    markers:[...(args.base.markers??[]).filter(m=>!String(m.id).startsWith('ms_ch_')),...manifest.chapters],
    ...(captionLines.length ? {captionLines, captions:{...args.base.captions,enabled:true}} : {}),
    motionStudio }
}

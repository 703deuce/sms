'use client'

import {
  coalescePendingChunks,
  uploadProgressFromMeta,
  MULTIPART_MIN_PART_BYTES,
} from '@/lib/recording/coalesce-parts'
import {
  getTrackMeta,
  listPendingChunksForTrack,
  markChunksUploaded,
  putTrackMeta,
  type TrackUploadMeta,
} from '@/lib/recording/chunk-store'

const ESTIMATED_TRACK_BYTES = 4 * 1024 * 1024 * 1024

export type TrackUploadProgress = {
  trackId: string
  participantId: string
  label: string
  percent: number
  stalled: boolean
  done: boolean
  error?: string
}

const STALL_MS = 45_000

async function putPartToS3(url: string, blob: Blob): Promise<string> {
  const res = await fetch(url, { method: 'PUT', body: blob })
  if (!res.ok) throw new Error(`Part upload failed (${res.status})`)
  const etag = res.headers.get('etag') ?? res.headers.get('ETag')
  if (!etag) throw new Error('Missing ETag')
  return etag.replace(/"/g, '')
}

export class TrackUploadManager {
  private nextPart = new Map<string, number>()
  private running = new Map<string, Promise<void>>()
  private lastProgressAt = new Map<string, number>()

  constructor(
    private sessionId: string,
    private onProgress: (rows: TrackUploadProgress[]) => void,
  ) {}

  async registerNoTracks(input: {
    participantId: string
    displayName: string
    takeId: string
  }) {
    const trackId = `no-tracks:${input.participantId}:${input.takeId}`
    await putTrackMeta({
      trackId,
      sessionId: this.sessionId,
      takeId: input.takeId,
      mimeType: 'text/plain',
      kind: 'NONE',
      participantId: input.participantId,
      displayName: input.displayName,
      actualStartHostMs: Date.now(),
      clockOffsetMs: 0,
      bytesUploaded: 0,
      bytesTotalEstimate: 1,
      multipartStarted: false,
      finalized: true,
      updatedAt: Date.now(),
    })
    await this.emitProgress()
  }

  async registerTrack(
    meta: Omit<
      TrackUploadMeta,
      'bytesUploaded' | 'bytesTotalEstimate' | 'multipartStarted' | 'finalized' | 'updatedAt'
    >,
  ) {
    await putTrackMeta({
      ...meta,
      bytesUploaded: 0,
      bytesTotalEstimate: ESTIMATED_TRACK_BYTES,
      multipartStarted: false,
      finalized: false,
      updatedAt: Date.now(),
    })
    this.nextPart.set(meta.trackId, 1)
    await this.pump(meta.trackId)
  }

  async pump(trackId: string, finalize = false) {
    if (this.running.has(trackId)) return this.running.get(trackId)
    const job = this._pump(trackId, finalize).finally(() => this.running.delete(trackId))
    this.running.set(trackId, job)
    return job
  }

  private async _pump(trackId: string, finalize: boolean) {
    const meta = await getTrackMeta(trackId)
    if (!meta) return
    const pending = await listPendingChunksForTrack(trackId)
    const startPart = this.nextPart.get(trackId) ?? 1
    const { parts, nextPartNumber } = coalescePendingChunks(pending, startPart, finalize)
    if (!parts.length && !finalize) {
      await this.emitProgress()
      return
    }

    if (!meta.multipartStarted && parts.length) {
      const initRes = await fetch(`/api/recording/uploads/${trackId}/parts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'init',
          sessionId: this.sessionId,
          bytesExpected: ESTIMATED_TRACK_BYTES,
          mimeType: meta.mimeType,
        }),
      })
      if (!initRes.ok) throw new Error('Upload init failed')
      meta.multipartStarted = true
      await putTrackMeta({ ...meta, multipartStarted: true, updatedAt: Date.now() })
    }

    for (const part of parts) {
      const presignRes = await fetch(`/api/recording/uploads/${trackId}/parts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'presign', partNumber: part.partNumber }),
      })
      const presignJson = await presignRes.json()
      const url = presignJson.data?.url as string
      if (!url) throw new Error('Presign failed')
      const etag = await putPartToS3(url, part.blob)
      await fetch(`/api/recording/uploads/${trackId}/parts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'part',
          partNumber: part.partNumber,
          etag,
          sizeBytes: part.sizeBytes,
          chunkSeqFrom: part.chunkSeqFrom,
          chunkSeqTo: part.chunkSeqTo,
        }),
      })
      await markChunksUploaded(trackId, part.chunkSeqFrom, part.chunkSeqTo, part.partNumber)
      meta.bytesUploaded += part.sizeBytes
      const est = Math.max(meta.bytesTotalEstimate, meta.bytesUploaded * 2)
      await putTrackMeta({
        ...meta,
        bytesUploaded: meta.bytesUploaded,
        bytesTotalEstimate: est,
        updatedAt: Date.now(),
      })
      this.nextPart.set(trackId, nextPartNumber)
      this.lastProgressAt.set(trackId, Date.now())
    }

    if (finalize) {
      const pendingBytes = pending.reduce((a, c) => a + c.blob.size, 0)
      const totalBytes = meta.bytesUploaded + pendingBytes
      if (totalBytes > 0 && totalBytes < meta.bytesTotalEstimate) {
        meta.bytesTotalEstimate = totalBytes
      }
      if (totalBytes > 0 || meta.multipartStarted) {
        await fetch(`/api/recording/uploads/${trackId}/complete`, { method: 'POST' })
      }
      await putTrackMeta({
        ...meta,
        bytesTotalEstimate: totalBytes > 0 ? totalBytes : meta.bytesTotalEstimate,
        finalized: true,
        updatedAt: Date.now(),
      })
    }
    await this.emitProgress()
  }

  async emitProgress() {
    const metas = await import('@/lib/recording/chunk-store').then((m) =>
      m.listTrackMetaForSession(this.sessionId),
    )
    const now = Date.now()
    const rows: TrackUploadProgress[] = metas.map((meta) => {
      const last = this.lastProgressAt.get(meta.trackId) ?? meta.updatedAt
      const stalled =
        !meta.finalized && meta.multipartStarted && now - last > STALL_MS && meta.bytesUploaded > 0
      const kindLabel =
        meta.kind === 'NONE'
          ? 'No tracks'
          : meta.kind === 'MICROPHONE'
            ? 'Microphone'
            : meta.kind === 'SCREEN'
              ? 'Screen'
              : 'Camera'
      const who = meta.displayName ?? meta.participantId.slice(0, 8)
      return {
        trackId: meta.trackId,
        participantId: meta.participantId,
        label: `${kindLabel} · ${who}`,
        percent: uploadProgressFromMeta(meta),
        stalled,
        done: meta.finalized,
      }
    })
    this.onProgress(rows)
  }

  static minPartBytes() {
    return MULTIPART_MIN_PART_BYTES
  }
}

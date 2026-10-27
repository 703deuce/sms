import type { StoredChunk } from '@/lib/recording/chunk-store'

export const RECORDING_CHUNK_TIMESLICE_MS = 6000
export const MULTIPART_MIN_PART_BYTES = 5 * 1024 * 1024

export type CoalescedPart = {
  partNumber: number
  blob: Blob
  chunkSeqFrom: number
  chunkSeqTo: number
  sizeBytes: number
}

/** Group pending chunks into ≥5 MiB parts (last part may be smaller on finalize). */
export function coalescePendingChunks(
  pending: StoredChunk[],
  nextPartNumber: number,
  finalize: boolean,
): { parts: CoalescedPart[]; nextPartNumber: number } {
  const sorted = [...pending].sort((a, b) => a.seq - b.seq)
  const parts: CoalescedPart[] = []
  let buffer: StoredChunk[] = []
  let size = 0
  let partNo = nextPartNumber

  const flush = (force: boolean) => {
    if (!buffer.length) return
    if (!force && size < MULTIPART_MIN_PART_BYTES) return
    const blob = new Blob(buffer.map((c) => c.blob))
    parts.push({
      partNumber: partNo,
      blob,
      chunkSeqFrom: buffer[0].seq,
      chunkSeqTo: buffer[buffer.length - 1].seq,
      sizeBytes: blob.size,
    })
    partNo += 1
    buffer = []
    size = 0
  }

  for (const chunk of sorted) {
    buffer.push(chunk)
    size += chunk.blob.size
    if (size >= MULTIPART_MIN_PART_BYTES) flush(true)
  }
  if (finalize) flush(true)

  return { parts, nextPartNumber: partNo }
}

export function uploadProgressFromMeta(meta: {
  bytesUploaded: number
  bytesTotalEstimate: number
  finalized: boolean
}): number {
  if (meta.finalized) return 100
  if (!meta.bytesTotalEstimate) return 0
  if (meta.bytesUploaded <= 0) return 0
  const pct = Math.round((meta.bytesUploaded / meta.bytesTotalEstimate) * 100)
  return meta.finalized ? 100 : Math.min(99, Math.max(1, pct))
}

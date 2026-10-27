/** IndexedDB persistence for MediaRecorder chunks (LiveKit brief §6.3). */

export const RECORDING_IDB_NAME = 'transovo-recording-v1'
export const RECORDING_IDB_VERSION = 1

export type StoredChunk = {
  id: string
  sessionId: string
  takeId: string
  trackId: string
  seq: number
  blob: Blob
  createdAt: number
  uploadedPartNumber?: number
}

export type TrackUploadMeta = {
  trackId: string
  sessionId: string
  takeId: string
  mimeType: string
  kind: string
  participantId: string
  displayName?: string
  actualStartHostMs: number
  clockOffsetMs: number
  bytesUploaded: number
  bytesTotalEstimate: number
  multipartStarted: boolean
  finalized: boolean
  updatedAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(RECORDING_IDB_NAME, RECORDING_IDB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('chunks')) {
        const store = db.createObjectStore('chunks', { keyPath: 'id' })
        store.createIndex('byTrack', 'trackId', { unique: false })
        store.createIndex('bySession', 'sessionId', { unique: false })
      }
      if (!db.objectStoreNames.contains('trackMeta')) {
        db.createObjectStore('trackMeta', { keyPath: 'trackId' })
      }
    }
  })
}

export async function putChunk(chunk: StoredChunk): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('chunks', 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore('chunks').put(chunk)
  })
  db.close()
}

export async function listChunksForTrack(trackId: string): Promise<StoredChunk[]> {
  const db = await openDb()
  const rows = await new Promise<StoredChunk[]>((resolve, reject) => {
    const tx = db.transaction('chunks', 'readonly')
    const req = tx.objectStore('chunks').index('byTrack').getAll(trackId)
    req.onsuccess = () => resolve((req.result as StoredChunk[]).sort((a, b) => a.seq - b.seq))
    req.onerror = () => reject(req.error)
  })
  db.close()
  return rows
}

export async function listPendingChunksForTrack(trackId: string): Promise<StoredChunk[]> {
  const all = await listChunksForTrack(trackId)
  return all.filter((c) => c.uploadedPartNumber == null)
}

export async function markChunksUploaded(trackId: string, seqFrom: number, seqTo: number, partNumber: number) {
  const db = await openDb()
  const chunks = await listChunksForTrack(trackId)
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('chunks', 'readwrite')
    const store = tx.objectStore('chunks')
    for (const c of chunks) {
      if (c.seq >= seqFrom && c.seq <= seqTo) {
        store.put({ ...c, uploadedPartNumber: partNumber })
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function putTrackMeta(meta: TrackUploadMeta): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('trackMeta', 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore('trackMeta').put(meta)
  })
  db.close()
}

export async function getTrackMeta(trackId: string): Promise<TrackUploadMeta | null> {
  const db = await openDb()
  const row = await new Promise<TrackUploadMeta | undefined>((resolve, reject) => {
    const tx = db.transaction('trackMeta', 'readonly')
    const req = tx.objectStore('trackMeta').get(trackId)
    req.onsuccess = () => resolve(req.result as TrackUploadMeta | undefined)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return row ?? null
}

export async function listAllTrackMeta(): Promise<TrackUploadMeta[]> {
  const db = await openDb()
  const rows = await new Promise<TrackUploadMeta[]>((resolve, reject) => {
    const tx = db.transaction('trackMeta', 'readonly')
    const req = tx.objectStore('trackMeta').getAll()
    req.onsuccess = () => resolve(req.result as TrackUploadMeta[])
    req.onerror = () => reject(req.error)
  })
  db.close()
  return rows
}

export async function listUnfinishedTrackMetas(): Promise<TrackUploadMeta[]> {
  const all = await listAllTrackMeta()
  return all.filter((m) => !m.finalized)
}

export async function listTrackMetaForSession(sessionId: string): Promise<TrackUploadMeta[]> {
  const db = await openDb()
  const rows = await new Promise<TrackUploadMeta[]>((resolve, reject) => {
    const tx = db.transaction('trackMeta', 'readonly')
    const req = tx.objectStore('trackMeta').getAll()
    req.onsuccess = () => {
      const all = (req.result as TrackUploadMeta[]).filter((m) => m.sessionId === sessionId)
      resolve(all)
    }
    req.onerror = () => reject(req.error)
  })
  db.close()
  return rows
}

export async function downloadTrackChunksAsBlob(trackId: string): Promise<Blob> {
  const chunks = await listChunksForTrack(trackId)
  const meta = await getTrackMeta(trackId)
  const mime = meta?.mimeType ?? 'application/octet-stream'
  return new Blob(chunks.map((c) => c.blob), { type: mime })
}

export async function deleteTrackLocalData(trackId: string): Promise<void> {
  const db = await openDb()
  const chunks = await listChunksForTrack(trackId)
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['chunks', 'trackMeta'], 'readwrite')
    const chunkStore = tx.objectStore('chunks')
    for (const c of chunks) chunkStore.delete(c.id)
    tx.objectStore('trackMeta').delete(trackId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

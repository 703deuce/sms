import { Server } from '@hocuspocus/server'
import * as Y from 'yjs'
import { verifyCollabToken, internalAuthHeader } from './token.js'

const port = Number(process.env.PORT || 1234)
const appUrl = (process.env.APP_URL || 'https://transovo.ai').replace(/\/$/, '')
const debounceMs = Number(process.env.SW_COLLAB_SAVE_MS || 2000)
const pending = new Map<string, ReturnType<typeof setTimeout>>()

async function loadYState(scriptId: string): Promise<Uint8Array | null> {
  const res = await fetch(`${appUrl}/api/internal/sw/collab-state?scriptId=${encodeURIComponent(scriptId)}`, {
    headers: { Authorization: internalAuthHeader() },
  })
  if (res.status === 204) return null
  if (!res.ok) return null
  return new Uint8Array(await res.arrayBuffer())
}

async function saveYState(scriptId: string, doc: Y.Doc) {
  const state = Y.encodeStateAsUpdate(doc)
  await fetch(`${appUrl}/api/internal/sw/collab-state`, {
    method: 'POST',
    headers: {
      Authorization: internalAuthHeader(),
      'Content-Type': 'application/octet-stream',
      'x-sw-script-id': scriptId,
    },
    body: state,
  })
}

function scriptIdFromName(name: string): string | null {
  const m = name.match(/^sw\/(.+)$/)
  return m?.[1] ?? null
}

const server = new Server({
  port,
  async onAuthenticate({ token }) {
    const payload = verifyCollabToken(token)
    if (!payload) throw new Error('Unauthorized')
    return { user: { id: payload.actorId, scriptId: payload.scriptId } }
  },
  async onLoadDocument({ document, documentName }) {
    const scriptId = scriptIdFromName(documentName)
    if (!scriptId) return
    const state = await loadYState(scriptId)
    if (state?.length) Y.applyUpdate(document, state)
  },
  async onChange({ document, documentName }) {
    const scriptId = scriptIdFromName(documentName)
    if (!scriptId) return
    const prev = pending.get(scriptId)
    if (prev) clearTimeout(prev)
    pending.set(
      scriptId,
      setTimeout(() => {
        pending.delete(scriptId)
        void saveYState(scriptId, document).catch((err) => console.error('[sw-collab] save failed', err))
      }, debounceMs),
    )
  },
})

server.listen()
console.log(`[sw-collab] listening on ${port}`)

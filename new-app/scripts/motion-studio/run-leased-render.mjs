// Installed on a renderer alongside the producer kit. The authenticated webhook
// passes its assignment on stdin. All API requests use the configured app origin.
import { createHash } from 'node:crypto'
import { createReadStream, openAsBlob } from 'node:fs'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const probe = promisify(execFile)
async function checked(url, options) {
  const response = await fetch(url, { ...options, redirect: 'error' })
  if (!response.ok) throw new Error('Worker request failed (HTTP ' + response.status + ')')
  return response
}

export async function uploadPrepared(prepared, blob, mime) {
  if (prepared.mode === 'signed_put') {
    await checked(prepared.signedPut.url, { method: 'PUT', headers: { 'content-type': mime }, body: blob })
    return []
  }
  if (prepared.mode === 's3_multipart') {
    const { partSize, partUrls } = prepared.s3Multipart
    const parts = []
    if (partUrls.length !== Math.ceil(blob.size / partSize)) throw new Error('Invalid part count')
    for (const { partNumber, url } of partUrls) {
      const from = (partNumber - 1) * partSize
      const response = await checked(url, { method: 'PUT', body: blob.slice(from, from + partSize) })
      const etag = response.headers.get('etag')
      if (!etag) throw new Error('Missing storage part receipt')
      parts.push({ partNumber, etag })
    }
    return parts
  }
  if (prepared.mode !== 'tus') throw new Error('Unsupported upload mode')
  const { endpoint, token, bucket, objectKey } = prepared.tus
  const headers = { 'Tus-Resumable': '1.0.0', 'x-signature': token }
  const metadata = Object.entries({ bucketName: bucket, objectName: objectKey, contentType: mime })
    .map(([key, value]) => key + ' ' + Buffer.from(value).toString('base64')).join(',')
  const created = await checked(endpoint, { method: 'POST', headers: { ...headers,
    'Upload-Length': String(blob.size), 'Upload-Metadata': metadata } })
  const location = created.headers.get('location')
  if (!location) throw new Error('Missing upload location')
  const target = new URL(location, endpoint)
  if (target.origin !== new URL(endpoint).origin) throw new Error('Unexpected upload origin')
  const chunk = 6 * 1024 * 1024
  for (let offset = 0; offset < blob.size; offset += chunk) {
    const end = Math.min(offset + chunk, blob.size)
    const response = await checked(target, { method: 'PATCH', headers: { ...headers,
      'Upload-Offset': String(offset), 'content-type': 'application/offset+octet-stream' }, body: blob.slice(offset, end) })
    if (response.headers.get('upload-offset') !== String(end)) throw new Error('Incomplete upload chunk')
  }
  return []
}

export async function runLeasedRender(assignment, { origin, workerId, credential, kitRoot }) {
  if (!origin || new URL(origin).protocol !== 'https:' || !credential || !workerId ||
      assignment.workerId !== workerId || assignment.action !== 'motion_studio_deterministic_render' ||
      !assignment.renderJobId || !assignment.leaseId) throw new Error('Invalid worker assignment')
  const jobId = assignment.renderJobId
  const endpoint = new URL('/api/motion-studio/agent/deterministic-jobs/' + encodeURIComponent(jobId), origin)
  const lease = { workerId, leaseId: assignment.leaseId }
  async function api(suffix = '', body) {
    const url = new URL(endpoint.href + suffix)
    if (!body) url.search = new URLSearchParams(lease).toString()
    const response = await checked(url, { method: body ? 'POST' : 'GET',
      headers: { authorization: 'Bearer ' + credential, 'content-type': 'application/json' },
      body: body ? JSON.stringify({ ...body, ...lease }) : undefined })
    return response.json()
  }
  const source = await api()
  if (source.id !== jobId || source.versionId !== assignment.versionId ||
      source.input?.mode !== 'deterministic_render' || source.input.dryRun) throw new Error('Unexpected render input')
  const tmp = await mkdtemp(path.join(tmpdir(), 'transovo-render-'))
  const renew = () => api('/report', { status: 'running' })
  const timer = setInterval(() => renew().catch(() => {}), 60000)
  try {
    await renew()
    const load = name => import(pathToFileURL(path.resolve(kitRoot, 'producer/lib', name)).href)
    const { StoreClient } = await load('store-client.mjs')
    const { deterministicRender } = await load('render-job.mjs')
    const records = new Map(source.sources.map(item => [item.id, item]))
    const local = new Map()
    let urls = source.assetUrls
    let refreshed = Date.now()
    let checkpoint = { revision: 0 }
    class LeasedStore extends StoreClient {
      async listVersions() { return { head: source.producerDocument.version } }
      async getVersion(project, version) {
        if (project !== source.projectId || version !== source.producerDocument.version) throw new Error('Unassigned project version')
        return source.producerDocument
      }
      async getFontCatalog() { return { fonts: source.producerDocument.fontRecords || [] } }
      async assetInfo(id) {
        const asset = records.get(id)
        if (!asset) throw new Error('Unregistered producer asset')
        if (Date.now() - refreshed > 10 * 60000) {
          urls = (await api()).assetUrls
          refreshed = Date.now()
        }
        return { asset, download: { url: urls[asset.storageId] } }
      }
      async fetchAsset(id, cache) {
        if (local.has(id)) return { path: local.get(id), asset: records.get(id) }
        return super.fetchAsset(id, cache)
      }
      async api(method, route) {
        if (method === 'GET' && route === '/agent/jobs/' + jobId + '/checkpoint') return checkpoint
        throw new Error('Unsupported producer request')
      }
      async checkpoint(_id, revision, state) { checkpoint = { revision, checkpoint: state } }
      async uploadFile(file, { kind, mime, meta }) {
        const hash = createHash('sha256')
        for await (const chunk of createReadStream(file)) hash.update(chunk)
        const sha256 = hash.digest('hex')
        const id = 'ast_' + sha256.slice(0, 32)
        const blob = await openAsBlob(file, { type: mime })
        // A completed report needs a master receipt from this exact assignment.
        if (!records.has(id) || meta?.role === 'master') {
          const prepared = await api('/assets', { action: 'prepare', filename: path.basename(file),
            bytes: blob.size, kind, mime, sha256 })
          const parts = await uploadPrepared(prepared, blob, mime)
          await api('/assets', { action: 'commit', uploadId: prepared.uploadId, parts })
          records.set(id, { id, storageId: prepared.uploadId, kind, mime, bytes: blob.size, sha256, meta })
        }
        local.set(id, file)
        return { assetId: id, sha256, bytes: blob.size }
      }
      async publishVersion(_project, _base, document) {
        const file = local.get(document.master.asset) || (await this.fetchAsset(document.master.asset, tmp)).path
        if (!local.has(document.master.asset)) {
          await this.uploadFile(file, { kind: 'video', mime: 'video/mp4', meta: { role: 'master' } })
        }
        const { stdout } = await probe('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
          '-of', 'default=nw=1:nk=1', file])
        const durationMs = Math.round(Number(stdout) * 1000)
        if (!(durationMs > 0)) throw new Error('Invalid rendered master')
        return api('/report', { status: 'complete', document, bundles: source.bundles,
          assets: [...records.values()], durationMs })
      }
    }
    await mkdir(path.join(tmp, 'work', 'render'), { recursive: true })
    await deterministicRender({ store: new LeasedStore({ apiBase: origin, jobToken: '' }),
      jobId, input: source.input, worker: { workerId }, workDir: path.join(tmp, 'work'),
      cacheDir: path.join(tmp, 'cache'), progress: renew })
  } catch (error) {
    await api('/report', { status: 'failed', error: 'Deterministic producer failed' }).catch(() => {})
    throw error
  } finally {
    clearInterval(timer)
    await rm(tmp, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    let payload = ''
    for await (const chunk of process.stdin) payload += chunk
    await runLeasedRender(JSON.parse(payload), { origin: process.env.MOTION_STUDIO_AGENT_PUBLIC_URL,
      workerId: process.env.MOTION_STUDIO_WORKER_ID, credential: process.env.MOTION_STUDIO_WORKER_TOKEN,
      kitRoot: process.env.MOTION_STUDIO_PRODUCER_KIT })
  } catch {
    console.error('Leased render failed')
    process.exitCode = 1
  }
}

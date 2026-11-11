/**
 * Version 1: checked-in clip font inventory. Git blob SHA-1 is an integrity
 * identifier for the browser binary, NOT a SHA-256 digest of worker bytes.
 *
 * Production cannot claim browser/worker font parity until the worker is
 * tested with exact hashes. Missing copyright/license provenance remains a
 * release blocker for any newly distributed font, not permission to download.
 * Font matching uses family NAME ID 1 (Lato.ttf identifies as Lato Black).
 */
export const CLIP_FONT_MANIFEST_VERSION = 1 as const
export type ClipFontManifestRow = {
  id: string
  assFamily: string
  cssWeight: number
  browserFile: string
  workerFile: string
  browserGitBlobSha1: string
  metricsKey: string
  sourceRevision: string
  licenseStatus: 'existing_repository_asset_provenance_unverified' | 'OFL-1.1'
  fallback: string
}
export const CLIP_FONT_MANIFEST: readonly ClipFontManifestRow[] = [
  {
    "id": "Anton",
    "assFamily": "Anton",
    "cssWeight": 400,
    "browserFile": "/fonts/clip/Anton-Regular.ttf",
    "workerFile": "worker/prototype/v3/fonts/Anton-Regular.ttf",
    "browserGitBlobSha1": "4d65707db9d8663ccfa99cd28cd3a4e0025be178",
    "metricsKey": "Anton",
    "sourceRevision": "db37033638feb92369c8eaec615ae7e8710163c7",
    "licenseStatus": "existing_repository_asset_provenance_unverified",
    "fallback": "DejaVu Sans"
  },
  {
    "id": "Montserrat",
    "assFamily": "Montserrat Black",
    "cssWeight": 900,
    "browserFile": "/fonts/clip/Montserrat-Black.ttf",
    "workerFile": "worker/prototype/v3/fonts/Montserrat-Black.ttf",
    "browserGitBlobSha1": "b4359a040f6ccf3f87a2ae3bf7312e4f2baf3a95",
    "metricsKey": "Montserrat Black",
    "sourceRevision": "db37033638feb92369c8eaec615ae7e8710163c7",
    "licenseStatus": "existing_repository_asset_provenance_unverified",
    "fallback": "DejaVu Sans"
  },
  {
    "id": "Poppins",
    "assFamily": "Poppins ExtraBold",
    "cssWeight": 800,
    "browserFile": "/fonts/clip/Poppins-ExtraBold.ttf",
    "workerFile": "worker/prototype/v3/fonts/Poppins-ExtraBold.ttf",
    "browserGitBlobSha1": "df7093608a7eb6173529ce9eeeb4d46e3a8290e5",
    "metricsKey": "Poppins ExtraBold",
    "sourceRevision": "db37033638feb92369c8eaec615ae7e8710163c7",
    "licenseStatus": "existing_repository_asset_provenance_unverified",
    "fallback": "DejaVu Sans"
  },
  {
    "id": "Bangers",
    "assFamily": "Bangers",
    "cssWeight": 400,
    "browserFile": "/fonts/clip/Bangers.ttf",
    "workerFile": "worker/v3/fonts/t6/Bangers.ttf",
    "browserGitBlobSha1": "9b0f8c1f1b45e7bb4971b7d6a8604f9aacacdd32",
    "metricsKey": "Bangers",
    "sourceRevision": "db37033638feb92369c8eaec615ae7e8710163c7",
    "licenseStatus": "existing_repository_asset_provenance_unverified",
    "fallback": "DejaVu Sans"
  },
  {
    "id": "Bebas Neue",
    "assFamily": "Bebas Neue",
    "cssWeight": 400,
    "browserFile": "/fonts/clip/BebasNeue.ttf",
    "workerFile": "worker/v3/fonts/t6/BebasNeue.ttf",
    "browserGitBlobSha1": "c328c6e08b20a20a1de47d823e007ee73812a438",
    "metricsKey": "Bebas Neue",
    "sourceRevision": "db37033638feb92369c8eaec615ae7e8710163c7",
    "licenseStatus": "existing_repository_asset_provenance_unverified",
    "fallback": "DejaVu Sans"
  },
  {
    "id": "Archivo Black",
    "assFamily": "Archivo Black",
    "cssWeight": 400,
    "browserFile": "/fonts/clip/ArchivoBlack.ttf",
    "workerFile": "worker/v3/fonts/t6/ArchivoBlack.ttf",
    "browserGitBlobSha1": "82d07de3b84ed4428f6a302b70f4b555148dfeb0",
    "metricsKey": "Archivo Black",
    "sourceRevision": "db37033638feb92369c8eaec615ae7e8710163c7",
    "licenseStatus": "existing_repository_asset_provenance_unverified",
    "fallback": "DejaVu Sans"
  },
  {
    "id": "Luckiest Guy",
    "assFamily": "Luckiest Guy",
    "cssWeight": 400,
    "browserFile": "/fonts/clip/LuckiestGuy.ttf",
    "workerFile": "worker/v3/fonts/t6/LuckiestGuy.ttf",
    "browserGitBlobSha1": "5ca663c2f05761356ca4427c084e4443a157f834",
    "metricsKey": "Luckiest Guy",
    "sourceRevision": "db37033638feb92369c8eaec615ae7e8710163c7",
    "licenseStatus": "existing_repository_asset_provenance_unverified",
    "fallback": "DejaVu Sans"
  },
  {
    "id": "Inter",
    "assFamily": "Inter",
    "cssWeight": 400,
    "browserFile": "/fonts/clip/Inter.ttf",
    "workerFile": "worker/v3/fonts/t6/Inter.ttf",
    "browserGitBlobSha1": "047c92f6e2212473dc436020afed689527076d44",
    "metricsKey": "Inter",
    "sourceRevision": "db37033638feb92369c8eaec615ae7e8710163c7",
    "licenseStatus": "existing_repository_asset_provenance_unverified",
    "fallback": "DejaVu Sans"
  },
  {
    "id": "Lato",
    "assFamily": "Lato Black",
    "cssWeight": 900,
    "browserFile": "/fonts/clip/Lato.ttf",
    "workerFile": "worker/v3/fonts/t6/Lato.ttf",
    "browserGitBlobSha1": "53a31ac8f56e9e3f67d35844f2b41ef9ade0e156",
    "metricsKey": "Lato",
    "sourceRevision": "db37033638feb92369c8eaec615ae7e8710163c7",
    "licenseStatus": "existing_repository_asset_provenance_unverified",
    "fallback": "DejaVu Sans"
  },
  {
    "id": "Oswald",
    "assFamily": "Oswald",
    "cssWeight": 400,
    "browserFile": "/fonts/clip/Oswald.ttf",
    "workerFile": "worker/v3/fonts/t6/Oswald.ttf",
    "browserGitBlobSha1": "d1a3b9cb1325bf20b3a06ef9849d21c411212a3b",
    "metricsKey": "Oswald",
    "sourceRevision": "db37033638feb92369c8eaec615ae7e8710163c7",
    "licenseStatus": "existing_repository_asset_provenance_unverified",
    "fallback": "DejaVu Sans"
  },
  {"id":"Rubik","assFamily":"Rubik","cssWeight":400,"browserFile":"/fonts/clip/Rubik.ttf","workerFile":"worker/v3/fonts/t6/Rubik.ttf","browserGitBlobSha1":"a59aeb632df494345a542697c357f608875481b0","metricsKey":"Rubik","sourceRevision":"5bb28733cec313b63fbd415b574b5ae35c8aa8b8","licenseStatus":"OFL-1.1","fallback":"DejaVu Sans"},
  {"id":"Gabarito","assFamily":"Gabarito","cssWeight":400,"browserFile":"/fonts/clip/Gabarito.ttf","workerFile":"worker/v3/fonts/t6/Gabarito.ttf","browserGitBlobSha1":"f048f3b6527b2aff1adb92bd682acb1d8adcdc9c","metricsKey":"Gabarito","sourceRevision":"5bb28733cec313b63fbd415b574b5ae35c8aa8b8","licenseStatus":"OFL-1.1","fallback":"DejaVu Sans"},
  {"id":"Fira Sans Condensed","assFamily":"Fira Sans Condensed","cssWeight":700,"browserFile":"/fonts/clip/FiraSansCondensed-Bold.ttf","workerFile":"worker/v3/fonts/t6/FiraSansCondensed-Bold.ttf","browserGitBlobSha1":"c18ac23ad51eee0df2fd905cce40047189ad6f77","metricsKey":"Fira Sans Condensed","sourceRevision":"5bb28733cec313b63fbd415b574b5ae35c8aa8b8","licenseStatus":"OFL-1.1","fallback":"DejaVu Sans"},
  {"id":"DM Serif Display","assFamily":"DM Serif Display","cssWeight":400,"browserFile":"/fonts/clip/DMSerifDisplay-Regular.ttf","workerFile":"worker/v3/fonts/t6/DMSerifDisplay-Regular.ttf","browserGitBlobSha1":"bc5ed0cea657f264ea9c2a11a54da62ed619c5da","metricsKey":"DM Serif Display","sourceRevision":"5bb28733cec313b63fbd415b574b5ae35c8aa8b8","licenseStatus":"OFL-1.1","fallback":"DejaVu Sans"},
  {"id":"Playfair Display","assFamily":"Playfair Display","cssWeight":400,"browserFile":"/fonts/clip/PlayfairDisplay.ttf","workerFile":"worker/v3/fonts/t6/PlayfairDisplay.ttf","browserGitBlobSha1":"7a09eb71f10622fd083134ac9ed46f59b21bee18","metricsKey":"Playfair Display","sourceRevision":"5bb28733cec313b63fbd415b574b5ae35c8aa8b8","licenseStatus":"OFL-1.1","fallback":"DejaVu Sans"},
  {"id":"Caveat","assFamily":"Caveat","cssWeight":400,"browserFile":"/fonts/clip/Caveat.ttf","workerFile":"worker/v3/fonts/t6/Caveat.ttf","browserGitBlobSha1":"f84acf2ce2d1b3329b194749530dbaec047e6df6","metricsKey":"Caveat","sourceRevision":"5bb28733cec313b63fbd415b574b5ae35c8aa8b8","licenseStatus":"OFL-1.1","fallback":"DejaVu Sans"},
  {"id":"Space Grotesk","assFamily":"Space Grotesk","cssWeight":400,"browserFile":"/fonts/clip/SpaceGrotesk.ttf","workerFile":"worker/v3/fonts/t6/SpaceGrotesk.ttf","browserGitBlobSha1":"a1b2e6c26093066510a31147e7aec9abdc8d6c5e","metricsKey":"Space Grotesk","sourceRevision":"5bb28733cec313b63fbd415b574b5ae35c8aa8b8","licenseStatus":"OFL-1.1","fallback":"DejaVu Sans"},
  {"id":"Space Mono","assFamily":"Space Mono","cssWeight":400,"browserFile":"/fonts/clip/SpaceMono-Regular.ttf","workerFile":"worker/v3/fonts/t6/SpaceMono-Regular.ttf","browserGitBlobSha1":"1cfa3653dc8ddb7aa9f4ef1c9c581e9516137e6e","metricsKey":"Space Mono","sourceRevision":"5bb28733cec313b63fbd415b574b5ae35c8aa8b8","licenseStatus":"OFL-1.1","fallback":"DejaVu Sans"}
] as const

export function findClipFont(id: string): ClipFontManifestRow | undefined {
  return CLIP_FONT_MANIFEST.find(f => f.id === id || f.assFamily === id)
}
/**
 * Opt-in verified local face loader. A FontFace created from the exact pinned
 * browser bytes is installed before any typography geometry is measured.
 * No network font fallback can turn a missing font into an apparently ready face.
 * Requires a secure-context crypto.subtle; callers must surface errors in the UI.
 */
const loaded = new Map<string, Promise<void>>()
async function verifyPinnedFont(row: ClipFontManifestRow): Promise<ArrayBuffer> {
  const response = await fetch(row.browserFile, { cache: 'force-cache', credentials: 'same-origin' })
  if (!response.ok) throw new Error('clip_font_http_' + response.status + ':' + row.id)
  const data = await response.arrayBuffer()
  if (!data.byteLength) throw new Error('clip_font_empty:' + row.id)
  if (!globalThis.crypto?.subtle) throw new Error('clip_font_crypto_unavailable:' + row.id)
  const prefix = new TextEncoder().encode('blob ' + data.byteLength + String.fromCharCode(0))
  const blobBytes = new Uint8Array(data)
  const combined = new Uint8Array(prefix.byteLength + blobBytes.byteLength)
  combined.set(prefix)
  combined.set(blobBytes, prefix.byteLength)
  const digest = await crypto.subtle.digest('SHA-1', combined)
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
  if (hash !== row.browserGitBlobSha1) throw new Error('clip_font_integrity_mismatch:' + row.id)
  return data
}

export async function waitForClipFont(id: string, timeoutMs = 5000): Promise<void> {
  const row = findClipFont(id)
  if (!row) throw new Error('clip_font_not_in_manifest:' + id)
  if (typeof document === 'undefined' || !document.fonts || typeof FontFace === 'undefined')
    throw new Error('clip_font_document_unavailable:' + id)
  let task = loaded.get(row.id)
  if (!task) {
    task = (async () => {
      const bytes = await verifyPinnedFont(row)
      const face = new FontFace(row.assFamily, bytes, { weight: String(row.cssWeight), style: 'normal' })
      await face.load()
      document.fonts.add(face)
      if (!document.fonts.check(row.cssWeight + ' 24px "' + row.assFamily + '"'))
        throw new Error('clip_font_missing:' + row.id)
    })()
    loaded.set(row.id, task)
    void task.catch(() => { if (loaded.get(row.id) === task) loaded.delete(row.id) })
  }
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([task, new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error('clip_font_timeout:' + row.id)), timeoutMs)
    })])
  } finally { if (timeout !== undefined) clearTimeout(timeout) }
}

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
  licenseStatus: 'existing_repository_asset_provenance_unverified'
  fallback: string
}
export const CLIP_FONT_MANIFEST: readonly ClipFontManifestRow[] = [
  {
    "id": "Anton",
    "assFamily": "Anton",
    "cssWeight": 400,
    "browserFile": "/fonts/clip/Anton-Regular.ttf",
    "workerFile": "worker/v3/fonts/Anton-Regular.ttf",
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
    "workerFile": "worker/v3/fonts/Montserrat-Black.ttf",
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
    "workerFile": "worker/v3/fonts/Poppins-ExtraBold.ttf",
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
  {
    "id": "DejaVu Sans",
    "assFamily": "DejaVu Sans",
    "cssWeight": 700,
    "browserFile": "/fonts/clip/DejaVuSans-Bold.ttf",
    "workerFile": "worker/v3/fonts/t6/DejaVuSans-Bold.ttf",
    "browserGitBlobSha1": "2cef1aaf19de8ea2cad1a8d81d7eb6347ad7be43",
    "metricsKey": "DejaVu Sans",
    "sourceRevision": "db37033638feb92369c8eaec615ae7e8710163c7",
    "licenseStatus": "existing_repository_asset_provenance_unverified",
    "fallback": "DejaVu Sans"
  }
] as const

export function findClipFont(id: string): ClipFontManifestRow | undefined {
  return CLIP_FONT_MANIFEST.find(f => f.id === id || f.assFamily === id)
}
/** Must explicitly resolve availability before geometry/pixel snapshot. */
export async function waitForClipFont(id: string, timeoutMs = 5000): Promise<void> {
  const font = findClipFont(id)
  if (!font) throw new Error('clip_font_not_in_manifest:' + id)
  if (typeof document === 'undefined' || !document.fonts) throw new Error('clip_font_document_unavailable')
  const cssFamily = '"' + font.assFamily.replace(/["\\]/g, '') + '"'
  const ready = Promise.resolve(document.fonts.load(font.cssWeight + ' 24px ' + cssFamily))
    .then(result => { if (!result.length || !document.fonts.check(font.cssWeight + ' 24px ' + cssFamily))
      throw new Error('clip_font_missing:' + id) })
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([ready, new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error('clip_font_timeout:' + id)), timeoutMs)
    })])
  } finally { if (timeout !== undefined) clearTimeout(timeout) }
}

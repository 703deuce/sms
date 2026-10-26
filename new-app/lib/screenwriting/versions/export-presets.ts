export interface ExportPreset {
  format: string
  includeTitlePage: boolean
  sceneNumbers: boolean
  watermark?: string
}

export function exportPresetForFrozenVersion(versionKind: string): ExportPreset | null {
  if (versionKind !== 'LOCK' && versionKind !== 'PRODUCTION_DRAFT') return null
  return {
    format: 'pdf',
    includeTitlePage: true,
    sceneNumbers: true,
    watermark: 'FROZEN',
  }
}

export function assertFrozenExportAllowed(versionKind: string | undefined): boolean {
  return !versionKind || versionKind === 'MANUAL' || versionKind === 'AUTO'
}

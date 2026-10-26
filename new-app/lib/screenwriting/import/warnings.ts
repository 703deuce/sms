export interface ImportWarning {
  code: string
  message: string
  severity: 'info' | 'warn' | 'error'
}

export function warningsFromFdxParse(stats: {
  paragraphCount: number
  unknownTypes: string[]
  droppedDual: number
}): ImportWarning[] {
  const out: ImportWarning[] = []
  if (stats.unknownTypes.length) {
    out.push({
      code: 'unknown_fdx_type',
      message: `Mapped ${stats.unknownTypes.length} custom types to General`,
      severity: 'warn',
    })
  }
  if (stats.droppedDual > 0) {
    out.push({ code: 'dual_dialogue', message: 'Some dual dialogue blocks need manual review', severity: 'warn' })
  }
  if (stats.paragraphCount === 0) {
    out.push({ code: 'empty', message: 'No paragraphs found', severity: 'error' })
  }
  return out
}

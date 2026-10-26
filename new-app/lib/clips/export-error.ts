export type ExportErrorView = {
  message: string
  details: string | null
}

export function formatExportError(raw: string | null | undefined): ExportErrorView {
  if (!raw?.trim()) {
    return { message: 'Export failed. Try again or edit the clip and re-export.', details: null }
  }
  const details = raw.trim()
  const lower = details.toLowerCase()
  if (lower.includes('no space left') || lower.includes('enospc')) {
    return { message: 'Server ran out of disk space during export.', details }
  }
  if (lower.includes('timed out') || lower.includes('timeout')) {
    return { message: 'Export timed out. Try again with a shorter clip.', details }
  }
  if (lower.includes('ffmpeg') || lower.includes('returned non-zero') || lower.includes('subprocess')) {
    return {
      message: 'Video processing failed. Try trimming the clip or changing layout settings.',
      details,
    }
  }
  if (lower.includes('not found') || lower.includes('missing')) {
    return { message: 'Source media is missing. Re-open the project or re-upload.', details }
  }
  if (lower.includes('download_object') && lower.includes('not associated with a value')) {
    return {
      message: 'Export hit an internal storage bug. Retry the export; if it persists, contact support.',
      details,
    }
  }
  if (lower.includes('unboundlocalerror')) {
    return {
      message: 'Export hit an internal processing error. Retry the export.',
      details,
    }
  }
  if (details.length <= 140 && !details.includes('\n')) {
    return { message: details, details: null }
  }
  return { message: 'Export failed. Open Details for the technical log.', details }
}
